// URLs to pre-cache for offline MediaPipe + LSTM assets.

export const MEDIAPIPE_VERSION = "0.5.1675471629";
export const MEDIAPIPE_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/holistic@${MEDIAPIPE_VERSION}/`;

/** Core MediaPipe Holistic files (~15 MB total) */
export const MEDIAPIPE_FILES = [
  "holistic.binarypb",
  "holistic_solution_packed_assets_loader.js",
  "holistic_solution_packed_assets.data",
  "holistic_solution_wasm_bin.js",
  "holistic_solution_simd_wasm_bin.js",
  "holistic_solution_simd_wasm_bin.wasm",
  "holistic_solution_wasm_bin.wasm",
  "pose_landmark_full.tflite",
  "face_landmark_with_attention.tflite",
  "hand_landmark_full.tflite",
  "pose_landmark_lite.tflite",
  "face_landmark.tflite",
  "palm_detection_full.tflite",
  "face_detection_short_range.tflite",
];

/** Sign classifier bundle (config always; weights after `npm run train:demo` / `train:wlasl`) */
export const LSTM_FILES = [
  "/models/lstm/config.json",
  "/models/lstm/model.json",
  "/models/lstm/group1-shard1of1.bin",
];

export const GLOSS2EN_FILES = ["/models/gloss2en/index.json"];

export const APP_SHELL = ["/", "/translate", "/reverse", "/history", "/settings", "/manifest.json"];

export function mediapipeUrl(file: string): string {
  return `${MEDIAPIPE_CDN}${file}`;
}

export function getAllCacheUrls(
  origin: string
): { url: string; group: "mediapipe" | "lstm" | "app" }[] {
  const items: { url: string; group: "mediapipe" | "lstm" | "app" }[] = [];

  for (const file of MEDIAPIPE_FILES) {
    items.push({ url: mediapipeUrl(file), group: "mediapipe" });
  }
  for (const path of LSTM_FILES) {
    items.push({ url: `${origin}${path}`, group: "lstm" });
  }
  for (const path of GLOSS2EN_FILES) {
    items.push({ url: `${origin}${path}`, group: "lstm" });
  }
  for (const path of APP_SHELL) {
    items.push({ url: `${origin}${path}`, group: "app" });
  }

  return items;
}
