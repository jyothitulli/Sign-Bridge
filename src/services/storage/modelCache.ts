// IndexedDB + Cache API helpers for offline model storage.

import { openDB, type IDBPDatabase } from "idb";
import { mediapipeUrl } from "@/config/modelManifest";

const DB_NAME = "signbridge-offline";
const DB_VERSION = 1;
const META_STORE = "meta";
export const CACHE_NAME = "signbridge-models-v2";

export interface CacheMeta {
  version: number;
  cachedAt: number;
  fileCount: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore(META_STORE);
      },
    });
  }
  return dbPromise;
}

export async function getCacheMeta(): Promise<CacheMeta | null> {
  const db = await getDb();
  return (await db.get(META_STORE, "cacheMeta")) ?? null;
}

export async function setCacheMeta(meta: CacheMeta): Promise<void> {
  const db = await getDb();
  await db.put(META_STORE, meta, "cacheMeta");
}

export async function isModelsCached(): Promise<boolean> {
  const meta = await getCacheMeta();
  return meta !== null && meta.version >= 1;
}

export async function clearModelCache(): Promise<void> {
  if (typeof caches !== "undefined") {
    await caches.delete(CACHE_NAME);
  }
  const db = await getDb();
  await db.delete(META_STORE, "cacheMeta");
}

export interface DownloadProgress {
  loaded: number;
  total: number;
  currentFile: string;
  mediapipe: number;
  lstm: number;
  overall: number;
}

/** Fetch URLs into Cache API with progress callbacks. */
export async function downloadModels(
  urls: { url: string; group: "mediapipe" | "lstm" | "app" }[],
  onProgress: (p: DownloadProgress) => void
): Promise<void> {
  if (typeof caches === "undefined") {
    throw new Error("Cache API not available");
  }

  const cache = await caches.open(CACHE_NAME);
  const total = urls.length;
  let loaded = 0;
  let mediapipeDone = 0;
  let lstmDone = 0;
  const mediapipeTotal = urls.filter((u) => u.group === "mediapipe").length;
  const lstmTotal = urls.filter((u) => u.group === "lstm").length;

  for (const { url, group } of urls) {
    onProgress({
      loaded,
      total,
      currentFile: url.split("/").pop() ?? url,
      mediapipe: mediapipeTotal ? Math.round((mediapipeDone / mediapipeTotal) * 100) : 100,
      lstm: lstmTotal ? Math.round((lstmDone / lstmTotal) * 100) : 100,
      overall: Math.round((loaded / total) * 100),
    });

    try {
      const existing = await cache.match(url);
      if (!existing) {
        const resp = await fetch(url, { mode: "cors", cache: "no-cache" });
        if (resp.ok) {
          await cache.put(url, resp);
        }
      }
    } catch {
      if (!url.includes("model.json")) {
        console.warn("[modelCache] Failed to cache:", url);
      }
    }

    loaded++;
    if (group === "mediapipe") mediapipeDone++;
    if (group === "lstm") lstmDone++;
  }

  await setCacheMeta({
    version: 1,
    cachedAt: Date.now(),
    fileCount: loaded,
  });

  onProgress({
    loaded: total,
    total,
    currentFile: "Done",
    mediapipe: 100,
    lstm: 100,
    overall: 100,
  });
}

/** CDN URL for MediaPipe — service worker serves cached copy when offline. */
export function resolveMediaPipeFile(file: string): string {
  return mediapipeUrl(file);
}
