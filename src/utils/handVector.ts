// 84-dim normalized hand feature vector (21 landmarks × 2 hands × xy).

import type { LandmarkFrame, Point3D } from "@/types";

const HAND_LANDMARK_COUNT = 21;
export const HAND_VECTOR_DIM = HAND_LANDMARK_COUNT * 2 * 2; // 84

export interface BodyFrame {
  centerX: number;
  shoulderY: number;
  scale: number;
}

export function getBodyFrame(frame: LandmarkFrame): BodyFrame | null {
  const pose = frame.poseLandmarks;
  if (!pose || pose.length < 13) return null;
  const ls = pose[11];
  const rs = pose[12];
  if (!ls || !rs) return null;
  return {
    centerX: (ls.x + rs.x) / 2,
    shoulderY: (ls.y + rs.y) / 2,
    scale: Math.max(Math.abs(rs.x - ls.x), 0.12),
  };
}

function normalizePoint(p: Point3D, body: BodyFrame): [number, number] {
  return [(p.x - body.centerX) / body.scale, (p.y - body.shoulderY) / body.scale];
}

/** Extract normalized x,y for both hands (zeros if hand missing). */
export function frameToHandVector(frame: LandmarkFrame): Float32Array | null {
  const body = getBodyFrame(frame);
  if (!body) return null;

  const v = new Float32Array(HAND_VECTOR_DIM);
  let idx = 0;

  for (const hand of [frame.leftHandLandmarks, frame.rightHandLandmarks]) {
    if (hand && hand.length >= HAND_LANDMARK_COUNT) {
      for (let i = 0; i < HAND_LANDMARK_COUNT; i++) {
        const [nx, ny] = normalizePoint(hand[i], body);
        v[idx++] = nx;
        v[idx++] = ny;
      }
    } else {
      idx += HAND_LANDMARK_COUNT * 2;
    }
  }
  return v;
}

export function vectorDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum / a.length);
}

/** Resample a variable-length sequence to fixed length (linear interpolation). */
export function resampleSequence(vectors: Float32Array[], targetLen: number): Float32Array[] {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) {
    return Array.from({ length: targetLen }, () => vectors[0].slice());
  }

  const result: Float32Array[] = [];
  for (let t = 0; t < targetLen; t++) {
    const pos = (t / (targetLen - 1)) * (vectors.length - 1);
    const i0 = Math.floor(pos);
    const i1 = Math.min(i0 + 1, vectors.length - 1);
    const frac = pos - i0;
    const out = new Float32Array(vectors[0].length);
    for (let d = 0; d < out.length; d++) {
      out[d] = vectors[i0][d] * (1 - frac) + vectors[i1][d] * frac;
    }
    result.push(out);
  }
  return result;
}

export function averageVectors(vectors: Float32Array[]): Float32Array {
  if (vectors.length === 0) return new Float32Array(HAND_VECTOR_DIM);
  const out = new Float32Array(vectors[0].length);
  for (const v of vectors) {
    for (let i = 0; i < out.length; i++) out[i] += v[i];
  }
  for (let i = 0; i < out.length; i++) out[i] /= vectors.length;
  return out;
}

export function interpolateVectors(a: Float32Array, b: Float32Array, t: number): Float32Array {
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] * (1 - t) + b[i] * t;
  return out;
}
