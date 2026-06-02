import {
  downloadModels,
  isModelsCached,
  clearModelCache,
  type DownloadProgress,
} from "@/services/storage/modelCache";
import { getAllCacheUrls } from "@/config/modelManifest";
import { initSignModel } from "@/services/sign/signModelInference";
import { initGloss2EnIndex } from "@/services/translation/gloss2enService";
import { initEn2GlossIndex } from "@/services/translation/en2glossService";

type StatusSetter = (status: "not_loaded" | "loading" | "ready" | "error") => void;
type ProgressSetter = (p: Partial<{ mediapipe: number; lstm: number; overall: number }>) => void;

let bootstrapped = false;

export async function bootstrapOfflineModels(
  setMediapipe: StatusSetter,
  setLstm: StatusSetter,
  setProgress: ProgressSetter,
  onProgress?: (p: DownloadProgress) => void
): Promise<"ready" | "downloaded"> {
  const cached = await isModelsCached();
  if (cached) {
    setMediapipe("ready");
    setProgress({ mediapipe: 100, lstm: 100, overall: 100 });
    const [signModel] = await Promise.all([
      initSignModel(),
      initGloss2EnIndex(),
      initEn2GlossIndex(),
    ]);
    setLstm(signModel === "ready" ? "ready" : "not_loaded");
    return "ready";
  }

  setMediapipe("loading");
  setLstm("loading");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urls = getAllCacheUrls(origin);

  await downloadModels(urls, (p) => {
    onProgress?.(p);
    setProgress({ mediapipe: p.mediapipe, lstm: p.lstm, overall: p.overall });
  });

  setMediapipe("ready");
  const [signModel] = await Promise.all([
    initSignModel(),
    initGloss2EnIndex(),
    initEn2GlossIndex(),
  ]);
  setLstm(signModel === "ready" ? "ready" : "not_loaded");
  return "downloaded";
}

export async function recacheOfflineModels(
  setMediapipe: StatusSetter,
  setLstm: StatusSetter,
  setProgress: ProgressSetter,
  onProgress?: (p: DownloadProgress) => void
): Promise<void> {
  await clearModelCache();
  bootstrapped = false;
  await bootstrapOfflineModels(setMediapipe, setLstm, setProgress, onProgress);
}

export function markBootstrapStarted(): boolean {
  if (bootstrapped) return false;
  bootstrapped = true;
  return true;
}

export function resetBootstrapFlag(): void {
  bootstrapped = false;
}
