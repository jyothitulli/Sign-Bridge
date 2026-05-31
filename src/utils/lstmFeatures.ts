// Shared LSTM feature spec — must match training/feature_extract.py (84-dim hand vectors × 30 timesteps).

import type { LandmarkFrame } from "@/types";
import { frameToHandVector, resampleSequence } from "@/utils/handVector";

export const LSTM_TIMESTEPS = 30;
export const LSTM_FEATURES = 84;

/** Convert a signing clip to a fixed [timesteps × features] matrix for the LSTM. */
export function framesToLstmMatrix(frames: LandmarkFrame[]): Float32Array[] | null {
  const vectors = frames
    .map(frameToHandVector)
    .filter((v): v is Float32Array => v !== null);

  if (vectors.length < 3) return null;

  return resampleSequence(vectors, LSTM_TIMESTEPS);
}

/** Flat row-major array for TensorFlow.js tensor3d. */
export function framesToLstmFlat(frames: LandmarkFrame[]): number[] | null {
  const matrix = framesToLstmMatrix(frames);
  if (!matrix) return null;
  return matrix.flatMap((row) => Array.from(row));
}
