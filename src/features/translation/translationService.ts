// src/features/translation/translationService.ts
// Orchestrates the full translation pipeline:
// LandmarkFrames → Word Sequence → Grammar Correction → Natural Sentence

import type {
  LandmarkFrame,
  TranslationResult,
 
  QuestionType,
  FlatFeatureVector,
} from "@/types";
import { FacialGrammarEngine } from "@/features/grammar/FacialGrammarEngine";
import { recognizeContinuousGloss } from "@/features/translation/continuousGlossRecognizer";
import { glossToEnglish } from "@/services/translation/gloss2enService";
import {
  initSignModel,
  isSignModelReady,
  getSignModelArchitecture,
} from "@/services/sign/signModelInference";

// ─── Feature Extraction ───────────────────────────────────────────────────────
// Converts MediaPipe landmark frame → flat 1629-element feature vector
// 543 landmarks × 3 coords (x, y, z)

export function extractFeatures(frame: LandmarkFrame): FlatFeatureVector {
  const features = new Float32Array(1629);
  let idx = 0;

  const fillLandmarks = (landmarks: { x: number; y: number; z: number }[], count: number) => {
    for (let i = 0; i < count; i++) {
      if (i < landmarks.length) {
        features[idx]     = landmarks[i].x;
        features[idx + 1] = landmarks[i].y;
        features[idx + 2] = landmarks[i].z;
      }
      // else stays 0 (zero-padding for missing landmarks)
      idx += 3;
    }
  };

  fillLandmarks(frame.poseLandmarks      ?? [], 33);  // 99  values
  fillLandmarks(frame.leftHandLandmarks  ?? [], 21);  // 63  values
  fillLandmarks(frame.rightHandLandmarks ?? [], 21);  // 63  values
  fillLandmarks(frame.faceLandmarks      ?? [], 468); // 1404 values
  // Total: 99 + 63 + 63 + 1404 = 1629 ✓

  return { features, timestamp: frame.timestamp };
}

// ─── Gesture classifier (CPU prototype matching) ─────────────────────────────

const WH_WORDS = new Set(["WHAT", "WHERE", "WHEN", "WHY", "WHO", "HOW"]);

function inferQuestionType(words: string[]): QuestionType {
  if (words.some((w) => WH_WORDS.has(w))) return "WH";
  if (words.length <= 2 && (words.includes("YOU") || words.includes("HUNGRY"))) return "YES_NO";
  return "STATEMENT";
}

// ─── Translation Pipeline ─────────────────────────────────────────────────────

export interface TranslationInput {
  frames: LandmarkFrame[];
  useMockData?: boolean;  // Set true until LSTM is ready
}

async function buildTranslationResult(
  frames: LandmarkFrame[],
  rawWords: string[],
  classifyConfidence: number,
  engine: TranslationResult["engine"]
): Promise<TranslationResult> {
  const started = Date.now();
  const facial = FacialGrammarEngine.analyze(frames);

  let words = rawWords;
  if (facial.tags.includes("NEGATION")) {
    words = FacialGrammarEngine.applyNegationToGloss(words);
  }

  const questionType = FacialGrammarEngine.resolveQuestionType(facial, words);

  let correctedSentence = "Could not recognize signs — try again with clearer hand movements.";
  let translationSource: TranslationResult["translationSource"];
  if (words.length > 0) {
    const translated = await glossToEnglish(words, questionType);
    correctedSentence = translated.sentence;
    translationSource = translated.source;
  }

  return {
    id: crypto.randomUUID(),
    rawWords: words,
    correctedSentence,
    questionType,
    confidence: Math.min(0.98, classifyConfidence * (facial.confidence > 0.3 ? 1 : 0.85)),
    timestamp: Date.now(),
    duration: Date.now() - started,
    engine,
    facialTags: facial.tags,
    translationSource,
  };
}

/** Translate a pre-built gloss sequence (facial grammar from frames). */
export async function translateGlossWords(
  rawWords: string[],
  frames: LandmarkFrame[],
  classifyConfidence = 0.85,
  engineOverride?: TranslationResult["engine"]
): Promise<TranslationResult> {
  await initSignModel();
  const arch = getSignModelArchitecture();
  const engine: TranslationResult["engine"] =
    engineOverride ??
    (isSignModelReady() ? (arch === "tcn" ? "tcn" : "lstm") : "dtw");
  return buildTranslationResult(frames, rawWords, classifyConfidence, engine);
}

export async function translateFrames(input: TranslationInput): Promise<TranslationResult> {
  const { frames } = input;

  await initSignModel();
  const arch = getSignModelArchitecture();
  let engine: TranslationResult["engine"] = "dtw";
  if (isSignModelReady()) {
    engine = arch === "tcn" ? "tcn" : "lstm";
  }

  const classified = await recognizeContinuousGloss(frames);
  let rawWords = classified.words;
  let classifyConfidence = classified.confidence;

  if (rawWords.length === 0 || classifyConfidence < 0.4) {
    rawWords = [];
    classifyConfidence = 0;
  }

  return buildTranslationResult(frames, rawWords, classifyConfidence, engine);
}

// ─── Reverse Mode: English → Sign Gloss ──────────────────────────────────────
// Converts natural English to ASL gloss order for avatar animation

const ARTICLES = new Set(["a", "an", "the"]);
const AUXILIARIES = new Set(["is", "are", "am", "do", "does", "did", "was", "were", "have", "has", "had", "will", "would", "can", "could", "should"]);
const REVERSE_WH = new Map([
  ["what", "WHAT"], ["where", "WHERE"], ["when", "WHEN"],
  ["why", "WHY"], ["who", "WHO"], ["how", "HOW"],
]);

export function englishToSignGloss(sentence: string): string[] {
  if (!sentence?.trim()) return [];

  const words = sentence
    .toLowerCase()
    .replace(/[?.!,;:]/g, "")
    .split(/\s+/)
    .filter(w => w.length > 0);

  const gloss: string[] = [];
  let whWord: string | null = null;

  for (const word of words) {
    // Skip articles
    if (ARTICLES.has(word)) continue;

    // Skip most auxiliaries (ASL expresses these through facial expressions)
    if (AUXILIARIES.has(word)) continue;

    // WH words go to end in ASL
    if (REVERSE_WH.has(word)) {
      whWord = REVERSE_WH.get(word)!;
      continue;
    }

    // Convert common English words to ASL gloss form
    const glossed = englishWordToGloss(word);
    if (glossed) gloss.push(glossed);
  }

  // Add WH-word at end (ASL grammar)
  if (whWord) gloss.push(whWord);

  return gloss;
}

function englishWordToGloss(word: string): string | null {
  // Skip very short words (conjunctions, prepositions handled separately)
  if (word.length <= 1) return null;

  // Common word mappings
  const wordMap: Record<string, string> = {
    // Pronouns
    "i": "I", "me": "ME", "my": "MY", "you": "YOU", "your": "YOUR",
    "he": "HE", "she": "SHE", "they": "THEY", "we": "WE",
    // Time
    "yesterday": "YESTERDAY", "today": "TODAY", "tomorrow": "TOMORROW",
    "now": "NOW", "later": "LATER",
    // Verbs: past → present (ASL uses present)
    "went": "GO", "ate": "EAT", "saw": "SEE", "bought": "BUY",
    "came": "COME", "felt": "FEEL", "had": "HAVE", "did": "DO",
    // Common prepositions kept
    "to": "TO", "from": "FROM", "at": "AT", "in": "IN",
    // Adjectives
    "very": "VERY", "really": "VERY",
    "hungry": "HUNGRY", "tired": "TIRED", "sick": "SICK",
    "hot": "HOT", "cold": "COLD", "happy": "HAPPY", "sad": "SAD",
    // Nouns
    "name": "NAME", "weather": "WEATHER", "time": "TIME",
    "store": "STORE", "school": "SCHOOL", "work": "WORK",
    "headache": "HEADACHE", "food": "FOOD", "water": "WATER",
  };

  if (wordMap[word]) return wordMap[word];

  // Default: uppercase the word
  return word.toUpperCase();
}