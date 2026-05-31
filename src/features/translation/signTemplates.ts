// Built-in sign templates — multi-frame hand vectors for DTW matching.

import type { GestureFeatures } from "@/utils/gestureFeatures";
import {
  HAND_VECTOR_DIM,
  interpolateVectors,
} from "@/utils/handVector";

export interface SignTemplate {
  word: string;
  sequence: Float32Array[];
  weight: number;
}

const NEUTRAL = (): Float32Array => new Float32Array(HAND_VECTOR_DIM);

/** Encode gesture features as a synthetic 84-dim hand vector. */
function featuresToVector(f: Partial<GestureFeatures>): Float32Array {
  const v = NEUTRAL();
  v[0] = f.rightWristRelX ?? 0;
  v[1] = f.rightWristRelY ?? 0;
  v[42] = f.leftWristRelX ?? 0;
  v[43] = f.leftWristRelY ?? 0;
  v[2] = f.fingerSpread ?? 0;
  v[44] = f.fingerSpread ?? 0;
  if (f.nearFace) v[4] = 1;
  if (f.lowHands) v[5] = 1;
  if (f.wristsTogether) v[6] = 1;
  if (f.bothHandsActive) v[7] = 1;
  if (f.rightHandActive) v[8] = 1;
  if (f.leftHandActive) v[9] = 1;
  return v;
}

function buildSequence(
  word: string,
  peak: Partial<GestureFeatures>,
  weight = 1
): SignTemplate {
  const neutral = featuresToVector({});
  const target = featuresToVector(peak);
  const frames = 12;
  const sequence: Float32Array[] = [];

  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1);
    // Rise to peak at 40%, hold, return
    let phase: number;
    if (t < 0.35) phase = t / 0.35;
    else if (t < 0.65) phase = 1;
    else phase = 1 - (t - 0.65) / 0.35;
    sequence.push(interpolateVectors(neutral, target, phase * 0.85 + 0.15));
  }

  return { word, sequence, weight };
}

const PEAKS: [string, Partial<GestureFeatures>, number?][] = [
  ["YOU", { rightHandActive: true, rightWristRelX: 0.45, rightWristRelY: -0.25, bothHandsActive: false }, 1.3],
  ["I", { rightHandActive: true, rightWristRelX: 0.08, rightWristRelY: -0.2, bothHandsActive: false }, 1.3],
  ["ME", { rightHandActive: true, rightWristRelX: 0.05, rightWristRelY: -0.15, bothHandsActive: false }],
  ["NAME", { bothHandsActive: true, wristsTogether: true, rightWristRelY: -0.28, leftWristRelY: -0.28 }, 1.4],
  ["WHAT", { bothHandsActive: true, rightWristRelY: -0.38, leftWristRelY: -0.35, fingerSpread: 0.45, wristsTogether: false }, 1.3],
  ["WHERE", { rightHandActive: true, rightWristRelX: 0.65, rightWristRelY: -0.32, bothHandsActive: false }, 1.2],
  ["WHEN", { bothHandsActive: true, rightWristRelY: -0.38, leftWristRelY: -0.36, wristsTogether: false }],
  ["WHY", { rightHandActive: true, nearFace: true, rightWristRelY: -0.42, bothHandsActive: false }],
  ["WHO", { bothHandsActive: true, rightWristRelY: -0.2, leftWristRelY: -0.2, wristsTogether: true }],
  ["HOW", { bothHandsActive: true, rightWristRelY: -0.15, leftWristRelY: -0.12, fingerSpread: 0.35 }],
  ["TIME", { bothHandsActive: true, rightWristRelY: -0.12, leftWristRelY: -0.1, wristsTogether: false }],
  ["EAT", { rightHandActive: true, nearFace: true, rightWristRelX: 0.05, rightWristRelY: -0.48, bothHandsActive: false }, 1.4],
  ["GO", { rightHandActive: true, rightWristRelX: 0.85, rightWristRelY: -0.05, bothHandsActive: false }, 1.2],
  ["STORE", { bothHandsActive: true, rightWristRelY: 0.05, leftWristRelY: 0.08, wristsTogether: false }],
  ["SCHOOL", { bothHandsActive: true, wristsTogether: true, rightWristRelY: -0.22 }],
  ["HUNGRY", { bothHandsActive: true, lowHands: true, wristsTogether: true, rightWristRelY: 0.25 }, 1.5],
  ["TIRED", { bothHandsActive: true, rightWristRelY: 0.05, leftWristRelY: 0.08, wristsTogether: true }, 1.3],
  ["VERY", { bothHandsActive: true, fingerSpread: 0.5, rightWristRelY: -0.1 }],
  ["HOT", { bothHandsActive: true, nearFace: true, rightWristRelY: -0.38, leftWristRelY: -0.35 }],
  ["COLD", { bothHandsActive: true, rightWristRelY: 0.18, leftWristRelY: 0.2, wristsTogether: true }],
  ["TODAY", { bothHandsActive: true, rightWristRelY: -0.22, leftWristRelY: -0.2, wristsTogether: true }],
  ["YESTERDAY", { rightHandActive: true, nearFace: true, rightWristRelY: -0.52, bothHandsActive: false }],
  ["TOMORROW", { rightHandActive: true, rightWristRelY: -0.35, rightWristRelX: 0.1, bothHandsActive: false }],
  ["WEATHER", { bothHandsActive: true, rightWristRelY: -0.38, leftWristRelY: -0.35, wristsTogether: false }],
  ["FEEL", { bothHandsActive: true, wristsTogether: true, rightWristRelY: -0.18 }],
  ["HEADACHE", { bothHandsActive: true, nearFace: true, rightWristRelY: -0.55, leftWristRelY: -0.52, wristsTogether: false }, 1.4],
  ["FROM", { rightHandActive: true, rightWristRelX: -0.55, rightWristRelY: 0.05, bothHandsActive: false }],
  ["HELLO", { rightHandActive: true, rightWristRelX: 0.55, rightWristRelY: -0.58, bothHandsActive: false }],
  ["THANK", { rightHandActive: true, rightWristRelY: 0.02, rightWristRelX: 0.05, bothHandsActive: false }],
  ["YES", { rightHandActive: true, rightWristRelX: 0.15, rightWristRelY: -0.28, bothHandsActive: false }],
  ["NO", { bothHandsActive: true, rightWristRelX: 0.35, leftWristRelX: -0.35, rightWristRelY: -0.05 }],
  ["MY", { rightHandActive: true, rightWristRelX: 0.02, rightWristRelY: -0.22, bothHandsActive: false }],
  ["YOUR", { rightHandActive: true, rightWristRelX: 0.4, rightWristRelY: -0.28, bothHandsActive: false }],
];

export const BUILTIN_TEMPLATES: SignTemplate[] = PEAKS.map(([word, peak, weight]) =>
  buildSequence(word, peak, weight ?? 1)
);

export function getAllBuiltinTemplates(): SignTemplate[] {
  return BUILTIN_TEMPLATES;
}
