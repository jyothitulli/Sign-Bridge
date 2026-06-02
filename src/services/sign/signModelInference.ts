// Unified TF.js sign classifier (LSTM or TCN) — same 84×30 input as training.

import * as tf from "@tensorflow/tfjs";
import type { LayersModel } from "@tensorflow/tfjs";
import type { LandmarkFrame } from "@/types";
import { framesToLstmMatrix, LSTM_FEATURES, LSTM_TIMESTEPS } from "@/utils/lstmFeatures";

export type SignModelArchitecture = "lstm" | "tcn";
export type SignModelStatus = "not_loaded" | "loading" | "ready" | "fallback";

export interface SignModelConfig {
  vocabulary: string[];
  timesteps: number;
  features: number;
  version: string;
  architecture?: SignModelArchitecture;
  featureSpec?: string;
}

const MODEL_PATHS = ["/models/lstm"];
const MIN_CONFIDENCE = 0.35;

let status: SignModelStatus = "not_loaded";
let model: LayersModel | null = null;
let config: SignModelConfig | null = null;
let loadedPath: string | null = null;

export function getSignModelStatus(): SignModelStatus {
  return status;
}

export function isSignModelReady(): boolean {
  return status === "ready" && model !== null && config !== null;
}

export function getSignModelVocabulary(): string[] {
  return config?.vocabulary ?? [];
}

export function getSignModelArchitecture(): SignModelArchitecture | null {
  return config?.architecture ?? null;
}

async function parseConfigResponse(resp: Response): Promise<SignModelConfig | null> {
  const text = await resp.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text) as SignModelConfig;
  } catch {
    return null;
  }
}

async function modelWeightsExist(basePath: string): Promise<boolean> {
  try {
    const res = await fetch(`${basePath}/model.json`, { method: "GET", cache: "no-store" });
    if (!res.ok) return false;
    const text = (await res.text()).trim();
    return text.length > 10 && text.startsWith("{");
  } catch {
    return false;
  }
}

async function tryLoadFrom(basePath: string): Promise<boolean> {
  const configResp = await fetch(`${basePath}/config.json`, { cache: "no-store" });
  if (!configResp.ok) return false;

  const cfg = await parseConfigResponse(configResp);
  if (!cfg?.vocabulary?.length) return false;

  if (!(await modelWeightsExist(basePath))) return false;

  try {
    const m = await tf.loadLayersModel(`${basePath}/model.json`);
    model = m;
    config = {
      ...cfg,
      architecture: cfg.architecture ?? "lstm",
      timesteps: cfg.timesteps ?? LSTM_TIMESTEPS,
      features: cfg.features ?? LSTM_FEATURES,
    };
    loadedPath = basePath;
    return true;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[SignModel] loadLayersModel failed for ${basePath}:`, err);
    }
    return false;
  }
}

async function preferFastBackend(): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && "gpu" in navigator) {
      await tf.setBackend("webgpu");
      await tf.ready();
      if (tf.getBackend() === "webgpu") return;
    }
  } catch {
    /* WebGPU unavailable */
  }
  await tf.setBackend("webgl");
  await tf.ready();
}

export async function initSignModel(): Promise<SignModelStatus> {
  if (status === "ready" || status === "fallback") return status;
  status = "loading";

  try {
    await preferFastBackend();
    for (const basePath of MODEL_PATHS) {
      if (await tryLoadFrom(basePath)) {
        status = "ready";
        console.info(
          `[SignModel] ${config?.architecture ?? "lstm"} loaded from ${basePath} —`,
          config?.vocabulary.length,
          "signs"
        );
        return status;
      }
    }
    model = null;
    config = null;
    status = "fallback";
    console.info("[SignModel] No model.json — using DTW classifier");
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.info("[SignModel] Using DTW fallback (no trained weights yet).");
    } else {
      console.warn("[SignModel] Init failed:", err);
    }
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

export async function predictSegmentWithSignModel(
  frames: LandmarkFrame[]
): Promise<{ word: string; confidence: number } | null> {
  if (!isSignModelReady() || !model || !config) return null;

  const timesteps = config.timesteps ?? LSTM_TIMESTEPS;
  const features = config.features ?? LSTM_FEATURES;
  if (timesteps !== LSTM_TIMESTEPS || features !== LSTM_FEATURES) {
    console.warn("[SignModel] Config shape mismatch — retrain with current feature spec");
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
    console.error("[SignModel] Inference error:", err);
    return null;
  }
}

export function disposeSignModel(): void {
  if (model) {
    model.dispose();
    model = null;
  }
  status = "not_loaded";
  config = null;
  loadedPath = null;
}

// Backwards-compatible aliases
export const initLstmModel = initSignModel;
export const isLstmReady = isSignModelReady;
export const predictSegmentWithLstm = predictSegmentWithSignModel;
export const getLstmStatus = getSignModelStatus;
export const getLstmVocabulary = getSignModelVocabulary;
export const disposeLstmModel = disposeSignModel;
