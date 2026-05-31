// IndexedDB storage for user-recorded sign templates (improves accuracy over time).

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LandmarkFrame } from "@/types";
import { frameToHandVector, resampleSequence } from "@/utils/handVector";
import type { SignTemplate } from "@/features/translation/signTemplates";

interface SignBridgeDB extends DBSchema {
  signTemplates: {
    key: string;
    value: UserSignTemplate;
    indexes: { "by-word": string };
  };
  trainingExports: {
    key: string;
    value: TrainingSample;
  };
}

export interface UserSignTemplate {
  id: string;
  word: string;
  /** Resampled 12-frame sequence stored as number[][] */
  sequence: number[][];
  createdAt: number;
  source: "practice" | "manual";
}

export interface TrainingSample {
  id: string;
  word: string;
  /** Raw frames serialized */
  frames: SerializedFrame[];
  createdAt: number;
}

interface SerializedFrame {
  pose: number[];
  leftHand: number[];
  rightHand: number[];
  face: number[];
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase<SignBridgeDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SignBridgeDB>("signbridge-training", 1, {
      upgrade(db) {
        const tpl = db.createObjectStore("signTemplates", { keyPath: "id" });
        tpl.createIndex("by-word", "word");
        db.createObjectStore("trainingExports", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

function serializeFrame(frame: LandmarkFrame): SerializedFrame {
  const flat = (pts: { x: number; y: number; z: number }[]) =>
    pts.flatMap((p) => [p.x, p.y, p.z]);
  return {
    pose: flat(frame.poseLandmarks ?? []),
    leftHand: flat(frame.leftHandLandmarks ?? []),
    rightHand: flat(frame.rightHandLandmarks ?? []),
    face: flat(frame.faceLandmarks ?? []),
    timestamp: frame.timestamp,
  };
}

function deserializeFrame(s: SerializedFrame): LandmarkFrame {
  const unflat = (arr: number[]) => {
    const pts = [];
    for (let i = 0; i < arr.length; i += 3) {
      pts.push({ x: arr[i], y: arr[i + 1], z: arr[i + 2] });
    }
    return pts;
  };
  return {
    poseLandmarks: unflat(s.pose),
    leftHandLandmarks: unflat(s.leftHand),
    rightHandLandmarks: unflat(s.rightHand),
    faceLandmarks: unflat(s.face),
    timestamp: s.timestamp,
  };
}

export async function saveUserTemplate(
  word: string,
  frames: LandmarkFrame[],
  source: "practice" | "manual" = "practice"
): Promise<UserSignTemplate> {
  const vectors = frames
    .map(frameToHandVector)
    .filter((v): v is Float32Array => v !== null);

  const resampled = resampleSequence(vectors, 12);
  const entry: UserSignTemplate = {
    id: crypto.randomUUID(),
    word: word.toUpperCase(),
    sequence: resampled.map((v) => Array.from(v)),
    createdAt: Date.now(),
    source,
  };

  const db = await getDb();
  await db.put("signTemplates", entry);
  return entry;
}

export async function saveTrainingSample(word: string, frames: LandmarkFrame[]): Promise<void> {
  const db = await getDb();
  await db.put("trainingExports", {
    id: crypto.randomUUID(),
    word: word.toUpperCase(),
    frames: frames.map(serializeFrame),
    createdAt: Date.now(),
  });
}

export async function getUserTemplatesAsSignTemplates(): Promise<SignTemplate[]> {
  const db = await getDb();
  const all = await db.getAll("signTemplates");
  return all.map((t) => ({
    word: t.word,
    sequence: t.sequence.map((row) => new Float32Array(row)),
    weight: 0.75, // user templates get priority (lower weight = better in dtwBestMatch)
  }));
}

export async function getUserTemplateCount(): Promise<number> {
  const db = await getDb();
  return db.count("signTemplates");
}

export async function getSampleCountsByWord(): Promise<Record<string, number>> {
  const db = await getDb();
  const all = await db.getAll("trainingExports");
  const counts: Record<string, number> = {};
  for (const s of all) {
    const w = s.word.toUpperCase();
    counts[w] = (counts[w] ?? 0) + 1;
  }
  return counts;
}

export async function getTotalSampleCount(): Promise<number> {
  const db = await getDb();
  return db.count("trainingExports");
}

export async function exportTrainingData(): Promise<string> {
  const db = await getDb();
  const samples = await db.getAll("trainingExports");
  const templates = await db.getAll("signTemplates");
  return JSON.stringify({ samples, templates, exportedAt: new Date().toISOString() }, null, 2);
}

export async function clearUserTemplates(): Promise<void> {
  const db = await getDb();
  await db.clear("signTemplates");
  await db.clear("trainingExports");
}

export { deserializeFrame };
