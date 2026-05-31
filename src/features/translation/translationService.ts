// src/features/translation/translationService.ts
// Orchestrates the full translation pipeline:
// LandmarkFrames → Word Sequence → Grammar Correction → Natural Sentence

import type {
  LandmarkFrame,
  TranslationResult,
 
  QuestionType,
  FlatFeatureVector,
} from "@/types";
import { GrammarEngine } from "@/features/grammar/GrammarEngine";
import { QuestionDetector } from "@/features/grammar/QuestionDetector";
import { classifySignSequence } from "@/features/translation/signClassifier";
import { initLstmModel, isLstmReady } from "@/services/lstm/lstmInference";

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

export async function translateFrames(input: TranslationInput): Promise<TranslationResult> {
  const startTime = Date.now();
  const { frames } = input;

  // ── Step 1: Detect question type from face expression ──
  const faceResult = QuestionDetector.analyzeBuffer(frames);

  // ── Step 2: Segment → classify each sign (LSTM per segment if trained, else DTW) ──
  await initLstmModel();

  let rawWords: string[];
  let classifyConfidence: number;
  let engine: "lstm" | "classifier" | "dtw" = isLstmReady() ? "lstm" : "dtw";

  const classified = await classifySignSequence(frames);
  rawWords = classified.words;
  classifyConfidence = classified.confidence;

  if (rawWords.length === 0 || classifyConfidence < 0.4) {
    rawWords = [];
    classifyConfidence = 0;
  }
  const questionType =
    faceResult.confidence > 0.5 ? faceResult.questionType : inferQuestionType(rawWords);

  // ── Step 3: Apply grammar correction ──
  const correctedSentence =
    rawWords.length > 0
      ? GrammarEngine.correct(rawWords, questionType)
      : "Could not recognize signs — try again with clearer hand movements.";

  // ── Step 4: Build result ──
  const result: TranslationResult = {
    id: crypto.randomUUID(),
    rawWords,
    correctedSentence,
    questionType,
    confidence: Math.min(0.98, classifyConfidence * (faceResult.confidence > 0.3 ? 1 : 0.85)),
    timestamp: Date.now(),
    duration: Date.now() - startTime,
    engine,
  };

  return result;
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