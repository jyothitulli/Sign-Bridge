// Hybrid gloss → English: trained index lookup + GrammarEngine fallback.

import type { QuestionType } from "@/types";
import { GrammarEngine } from "@/features/grammar/GrammarEngine";

interface Gloss2EnEntry {
  english: string;
  questionType?: QuestionType;
}

interface Gloss2EnIndex {
  version: string;
  count: number;
  entries: Record<string, Gloss2EnEntry>;
}

let index: Gloss2EnIndex | null = null;
let loadPromise: Promise<boolean> | null = null;

function glossKey(words: string[]): string {
  return words.map((w) => w.trim().toUpperCase()).filter(Boolean).join(" ");
}

export async function initGloss2EnIndex(): Promise<boolean> {
  if (index) return true;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const res = await fetch("/models/gloss2en/index.json");
      if (!res.ok) return false;
      index = (await res.json()) as Gloss2EnIndex;
      return (index?.entries && Object.keys(index.entries).length > 0) ?? false;
    } catch {
      return false;
    } finally {
      loadPromise = null;
    }
  })();

  return loadPromise;
}

export function isGloss2EnReady(): boolean {
  return index !== null && Object.keys(index.entries).length > 0;
}

/**
 * Translate gloss sequence to natural English.
 * Uses How2Sign-trained index when available; GrammarEngine always polishes output.
 */
export async function glossToEnglish(
  rawWords: string[],
  questionType: QuestionType
): Promise<{ sentence: string; source: "index" | "grammar" | "hybrid" }> {
  await initGloss2EnIndex();

  const key = glossKey(rawWords);
  const qType = questionType;

  if (index?.entries[key]) {
    const hit = index.entries[key];
    const base = hit.english.trim();
    const polished = GrammarEngine.correct(rawWords, hit.questionType ?? qType);
    const useIndex =
      polished.toLowerCase() === key.toLowerCase() ||
      polished.split(" ").length < 3;
    const sentence = useIndex ? base : polished;
    return { sentence, source: useIndex ? "index" : "hybrid" };
  }

  return {
    sentence: GrammarEngine.correct(rawWords, qType),
    source: "grammar",
  };
}
