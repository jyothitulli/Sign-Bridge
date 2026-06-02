// English → ASL gloss via gloss2en index (inverse lookup) + rule fallback.

import { englishToGloss as ruleBasedGloss } from "@/features/reverse/ReverseGrammarEngine";
import { initGloss2EnIndex } from "@/services/translation/gloss2enService";

let reverseMap: Map<string, string[]> | null = null;

function normalizeEnglish(sentence: string): string {
  return sentence
    .toLowerCase()
    .replace(/[?!.,;:'"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildReverseMap(entries: Record<string, { english: string }>): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [glossKey, val] of Object.entries(entries)) {
    const norm = normalizeEnglish(val.english);
    if (!norm) continue;
    map.set(norm, glossKey.split(" ").filter(Boolean));
  }
  return map;
}

export async function initEn2GlossIndex(): Promise<boolean> {
  const ok = await initGloss2EnIndex();
  if (!ok) return false;

  try {
    const res = await fetch("/models/gloss2en/index.json");
    if (!res.ok) return false;
    const data = (await res.json()) as {
      entries?: Record<string, { english: string }>;
      reverse?: Record<string, string[]>;
    };

    if (data.reverse && Object.keys(data.reverse).length > 0) {
      reverseMap = new Map(
        Object.entries(data.reverse).map(([en, gloss]) => [normalizeEnglish(en), gloss])
      );
    } else if (data.entries) {
      reverseMap = buildReverseMap(data.entries);
    }
    return (reverseMap?.size ?? 0) > 0;
  } catch {
    return false;
  }
}

export function englishToGlossFromIndex(sentence: string): string[] | null {
  if (!reverseMap) return null;
  const key = normalizeEnglish(sentence);
  return reverseMap.get(key) ?? null;
}

/**
 * English sentence → ASL gloss order.
 * Uses trained index when the exact sentence was seen in How2Sign/seed data.
 */
export async function englishToGlossHybrid(sentence: string): Promise<{
  gloss: string[];
  source: "index" | "rules";
}> {
  await initEn2GlossIndex();
  const fromIndex = englishToGlossFromIndex(sentence);
  if (fromIndex?.length) {
    return { gloss: fromIndex, source: "index" };
  }
  return { gloss: ruleBasedGloss(sentence), source: "rules" };
}
