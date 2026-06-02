// Continuous gloss recognition: segment clip → classify each sign → dedupe.

import type { LandmarkFrame } from "@/types";
import {
  classifySignSequence,
  segmentSignFrames,
} from "@/features/translation/signClassifier";

export interface ContinuousGlossResult {
  words: string[];
  confidence: number;
  segmentCount: number;
}

/**
 * Recognize a multi-sign utterance from one landmark buffer.
 * Uses motion-based segmentation + per-segment TCN/LSTM/DTW classifier.
 */
export async function recognizeContinuousGloss(
  frames: LandmarkFrame[]
): Promise<ContinuousGlossResult> {
  const segments = segmentSignFrames(frames);
  const classified = await classifySignSequence(frames);

  return {
    words: classified.words,
    confidence: classified.confidence,
    segmentCount: segments.length,
  };
}
