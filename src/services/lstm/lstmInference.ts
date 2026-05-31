// TensorFlow.js LSTM — per-segment word classification (matches training/feature_extract.py).

import * as tf from "@tensorflow/tfjs";
import type { LayersModel } from "@tensorflow/tfjs";
import type { LandmarkFrame } from "@/types";
import { framesToLstmMatrix, LSTM_FEATURES, LSTM_TIMESTEPS } from "@/utils/lstmFeatures";

export interface LstmConfig {
  vocabulary: string[];
  timesteps: number;
  features: number;
  version: string;
  featureSpec?: string;
}

type LstmStatus = "not_loaded" | "loading" | "ready" | "fallback";

let status: LstmStatus = "not_loaded";
let model: LayersModel | null = null;
let config: LstmConfig | null = null;

const MIN_CONFIDENCE = 0.35;

export function getLstmStatus(): LstmStatus {
  return status;
}

export function isLstmReady(): boolean {
  return status === "ready" && model !== null && config !== null;
}

export function getLstmVocabulary(): string[] {
  return config?.vocabulary ?? [];
}

export async function initLstmModel(): Promise<LstmStatus> {
  if (status === "ready" || status === "fallback") return status;
  status = "loading";

  try {
    const configResp = await fetch("/models/lstm/config.json");
    if (!configResp.ok) throw new Error("config missing");
    config = (await configResp.json()) as LstmConfig;

    try {
      model = await tf.loadLayersModel("/models/lstm/model.json");
      status = "ready";
      console.info("[LSTM] Model loaded —", config.vocabulary.length, "signs");
    } catch {
      model = null;
      status = "fallback";
      console.info("[LSTM] No model.json yet — using DTW classifier");
    }
  } catch (err) {
    console.warn("[LSTM] Init failed:", err);
    status = "fallback";
  }

  return status;
}

function framesToTensor(frames: LandmarkFrame[]): tf.Tensor3D | null {
  const matrix = framesToLstmMatrix(frames);
  if (!matrix) return null;
  const rows = matrix.map((row) => Array.from(row));
  return tf.tensor3d([rows]);
}

/** Classify a single sign segment → one word (used by signClassifier). */
export async function predictSegmentWithLstm(
  frames: LandmarkFrame[]
): Promise<{ word: string; confidence: number } | null> {
  if (!isLstmReady() || !model || !config) return null;

  const timesteps = config.timesteps ?? LSTM_TIMESTEPS;
  const features = config.features ?? LSTM_FEATURES;
  if (timesteps !== LSTM_TIMESTEPS || features !== LSTM_FEATURES) {
    console.warn("[LSTM] Config shape mismatch — retrain with current feature spec");
    return null;
  }

  const tensor = framesToTensor(frames);
  if (!tensor) return null;

  try {
    const prediction = model.predict(tensor) as tf.Tensor;
    const data = await prediction.data();
    tf.dispose([tensor, prediction]);

    let bestIdx = 0;
    let bestVal = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] > bestVal) {
        bestVal = data[i];
        bestIdx = i;
      }
    }

    if (bestVal < MIN_CONFIDENCE || bestIdx >= config.vocabulary.length) return null;

    return {
      word: config.vocabulary[bestIdx],
      confidence: Math.min(0.98, bestVal),
    };
  } catch (err) {
    tf.dispose(tensor);
    console.error("[LSTM] Inference error:", err);
    return null;
  }
}

export function disposeLstmModel(): void {
  if (model) {
    model.dispose();
    model = null;
  }
  status = "not_loaded";
  config = null;
}
