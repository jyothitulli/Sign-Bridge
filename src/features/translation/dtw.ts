// Dynamic Time Warping — compares two sequences of hand vectors.

import { vectorDistance } from "@/utils/handVector";

/** Normalized DTW distance (lower = better match). */
export function dtwDistance(seqA: Float32Array[], seqB: Float32Array[]): number {
  const n = seqA.length;
  const m = seqB.length;
  if (n === 0 || m === 0) return Infinity;

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array(m + 1).fill(Infinity)
  );
  dp[0][0] = 0;

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = vectorDistance(seqA[i - 1], seqB[j - 1]);
      dp[i][j] = cost + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[n][m] / (n + m);
}

export function dtwBestMatch(
  query: Float32Array[],
  templates: { word: string; sequence: Float32Array[]; weight?: number }[]
): { word: string; distance: number; confidence: number } | null {
  if (query.length === 0 || templates.length === 0) return null;

  let bestWord = templates[0].word;
  let bestDist = Infinity;

  for (const tpl of templates) {
    const dist = dtwDistance(query, tpl.sequence) / (tpl.weight ?? 1);
    if (dist < bestDist) {
      bestDist = dist;
      bestWord = tpl.word;
    }
  }

  // Map distance to confidence — tuned for normalized hand vectors
  const confidence = Math.max(0.35, Math.min(0.98, 1 - bestDist / 1.2));
  return { word: bestWord, distance: bestDist, confidence };
}
