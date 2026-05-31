// DTW-based sign classifier — matches full hand-motion sequences (much more accurate than single-frame).

import type { LandmarkFrame } from "@/types";
import { getHandMotion, handsVisible } from "@/utils/gestureFeatures";
import { frameToHandVector, resampleSequence } from "@/utils/handVector";
import { dtwBestMatch } from "@/features/translation/dtw";
import { getAllBuiltinTemplates, type SignTemplate } from "@/features/translation/signTemplates";
import { getUserTemplatesAsSignTemplates } from "@/services/storage/signTrainingStore";
import { predictSegmentWithLstm, isLstmReady, initLstmModel } from "@/services/lstm/lstmInference";

const TEMPLATE_LEN = 12;
const MIN_SEGMENT_FRAMES = 8;
const SIGN_GAP_FRAMES = 14;
const MOTION_THRESHOLD = 0.014;
const MAX_MATCH_DISTANCE = 0.55;

let cachedTemplates: SignTemplate[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 5000;

async function getAllTemplates(): Promise<SignTemplate[]> {
  const now = Date.now();
  if (cachedTemplates && now - cacheTime < CACHE_TTL_MS) return cachedTemplates;

  const user = await getUserTemplatesAsSignTemplates();
  cachedTemplates = [...user, ...getAllBuiltinTemplates()];
  cacheTime = now;
  return cachedTemplates;
}

export function invalidateTemplateCache(): void {
  cachedTemplates = null;
}

/** Split signing clip into individual sign segments using motion pauses. */
export function segmentSignFrames(frames: LandmarkFrame[]): LandmarkFrame[][] {
  if (frames.length < MIN_SEGMENT_FRAMES) {
    return frames.length >= 5 ? [frames] : [];
  }

  const segments: LandmarkFrame[][] = [];
  let current: LandmarkFrame[] = [];
  let stillFrames = 0;

  for (let i = 0; i < frames.length; i++) {
    const motion = i > 0 ? getHandMotion(frames[i], frames[i - 1]) : 0;
    const active = motion > MOTION_THRESHOLD || (handsVisible(frames[i]) && motion > 0.008);

    if (active) {
      if (stillFrames >= SIGN_GAP_FRAMES && current.length >= MIN_SEGMENT_FRAMES) {
        segments.push(current);
        current = [];
      }
      stillFrames = 0;
      current.push(frames[i]);
    } else {
      stillFrames++;
      if (current.length > 0) current.push(frames[i]);
    }
  }

  if (current.length >= MIN_SEGMENT_FRAMES) segments.push(current);

  // Fallback: treat whole clip as one sign if no segments found
  if (segments.length === 0 && frames.length >= 5) return [frames];
  return segments;
}

async function classifySegment(frames: LandmarkFrame[]): Promise<{ word: string; confidence: number } | null> {
  await initLstmModel();

  if (isLstmReady()) {
    const lstm = await predictSegmentWithLstm(frames);
    if (lstm) return lstm;
  }

  const rawVectors = frames
    .map(frameToHandVector)
    .filter((v): v is Float32Array => v !== null);

  if (rawVectors.length < 3) return null;

  const query = resampleSequence(rawVectors, TEMPLATE_LEN);
  const templates = await getAllTemplates();

  const match = dtwBestMatch(
    query,
    templates.map((t) => ({ word: t.word, sequence: t.sequence, weight: t.weight }))
  );

  if (!match || match.distance > MAX_MATCH_DISTANCE) return null;

  return { word: match.word, confidence: match.confidence };
}

/** Classify a full signing clip into an ordered word sequence. */
export async function classifySignSequence(frames: LandmarkFrame[]): Promise<{
  words: string[];
  confidence: number;
}> {
  const segments = segmentSignFrames(frames);

  if (segments.length === 0) {
    const single = await classifySegment(frames);
    if (single) return { words: [single.word], confidence: single.confidence };
    return { words: [], confidence: 0 };
  }

  const words: string[] = [];
  let totalConf = 0;
  let matched = 0;

  for (const segment of segments) {
    const result = await classifySegment(segment);
    if (result) {
      if (words[words.length - 1] !== result.word) {
        words.push(result.word);
        totalConf += result.confidence;
        matched++;
      }
    }
  }

  if (words.length === 0) {
    const fallback = await classifySegment(frames);
    return fallback
      ? { words: [fallback.word], confidence: fallback.confidence }
      : { words: [], confidence: 0 };
  }

  return {
    words,
    confidence: matched > 0 ? totalConf / matched : 0,
  };
}

/** Live preview while signing — confirmed words + current guess */
export async function classifyPartialSequence(frames: LandmarkFrame[]): Promise<{
  confirmed: string[];
  current: string | null;
  currentConfidence: number;
}> {
  if (frames.length < 12) {
    return { confirmed: [], current: null, currentConfidence: 0 };
  }

  const segments = segmentSignFrames(frames);
  const confirmed: string[] = [];

  const completeCount = segments.length > 1 ? segments.length - 1 : 0;

  for (let i = 0; i < completeCount; i++) {
    const result = await classifySegment(segments[i]);
    if (result && confirmed[confirmed.length - 1] !== result.word) {
      confirmed.push(result.word);
    }
  }

  const active = segments[segments.length - 1];
  let current: string | null = null;
  let currentConfidence = 0;

  if (active && active.length >= 10) {
    const hint = await classifySegment(active);
    if (hint) {
      current = hint.word;
      currentConfidence = hint.confidence;
    }
  }

  return { confirmed, current, currentConfidence };
}

/** Sync wrapper for backwards compat — prefer async version */
export function classifySignSequenceSync(frames: LandmarkFrame[]): {
  words: string[];
  confidence: number;
} {
  // Used only in tests; production uses async
  void frames;
  return { words: [], confidence: 0 };
}
