// Simplified 2D stick-figure poses for demo reverse mode (CPU-only, no 3D model).
// Each pose uses normalized joint coords (0–1) relative to canvas.

export interface SkeletonJoint {
  x: number;
  y: number;
}

export interface SkeletonPose {
  head: SkeletonJoint;
  neck: SkeletonJoint;
  leftShoulder: SkeletonJoint;
  rightShoulder: SkeletonJoint;
  leftElbow: SkeletonJoint;
  rightElbow: SkeletonJoint;
  leftWrist: SkeletonJoint;
  rightWrist: SkeletonJoint;
  hip: SkeletonJoint;
  leftKnee: SkeletonJoint;
  rightKnee: SkeletonJoint;
  leftAnkle: SkeletonJoint;
  rightAnkle: SkeletonJoint;
}

export interface SignPoseSequence {
  word: string;
  keyframes: SkeletonPose[];
  /** ms per keyframe segment */
  frameDuration: number;
}

/** Neutral standing pose — base for interpolation */
export const NEUTRAL_POSE: SkeletonPose = {
  head: { x: 0.5, y: 0.12 },
  neck: { x: 0.5, y: 0.2 },
  leftShoulder: { x: 0.38, y: 0.24 },
  rightShoulder: { x: 0.62, y: 0.24 },
  leftElbow: { x: 0.32, y: 0.38 },
  rightElbow: { x: 0.68, y: 0.38 },
  leftWrist: { x: 0.28, y: 0.52 },
  rightWrist: { x: 0.72, y: 0.52 },
  hip: { x: 0.5, y: 0.48 },
  leftKnee: { x: 0.44, y: 0.68 },
  rightKnee: { x: 0.56, y: 0.68 },
  leftAnkle: { x: 0.42, y: 0.88 },
  rightAnkle: { x: 0.58, y: 0.88 },
};

function pose(overrides: Partial<SkeletonPose>): SkeletonPose {
  return { ...NEUTRAL_POSE, ...overrides };
}

function seq(word: string, keyframes: SkeletonPose[], frameDuration = 400): SignPoseSequence {
  return { word, keyframes, frameDuration };
}

/** Dictionary of ~25 common signs for MVP */
export const SIGN_DICTIONARY: Record<string, SignPoseSequence> = {
  YOU: seq("YOU", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.55, y: 0.35 }, rightElbow: { x: 0.58, y: 0.28 } }),
  ]),
  I: seq("I", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.52, y: 0.22 }, rightElbow: { x: 0.54, y: 0.3 } }),
  ]),
  ME: seq("ME", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.5, y: 0.28 }, rightElbow: { x: 0.52, y: 0.32 } }),
  ]),
  NAME: seq("NAME", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.42, y: 0.32 },
      rightWrist: { x: 0.58, y: 0.32 },
      leftElbow: { x: 0.4, y: 0.28 },
      rightElbow: { x: 0.6, y: 0.28 },
    }),
  ]),
  WHAT: seq("WHAT", [
    NEUTRAL_POSE,
    pose({
      rightWrist: { x: 0.62, y: 0.4 },
      leftWrist: { x: 0.38, y: 0.42 },
      head: { x: 0.5, y: 0.1 },
    }),
  ], 500),
  WHERE: seq("WHERE", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.7, y: 0.35 }, rightElbow: { x: 0.65, y: 0.28 } }),
  ]),
  WHEN: seq("WHEN", [
    NEUTRAL_POSE,
    pose({ leftWrist: { x: 0.35, y: 0.3 }, rightWrist: { x: 0.65, y: 0.3 } }),
  ]),
  WHY: seq("WHY", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.55, y: 0.25 }, head: { x: 0.5, y: 0.11 } }),
  ]),
  WHO: seq("WHO", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.58, y: 0.38 }, leftWrist: { x: 0.42, y: 0.38 } }),
  ]),
  HOW: seq("HOW", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.4, y: 0.45 },
      rightWrist: { x: 0.6, y: 0.45 },
    }),
  ]),
  GO: seq("GO", [
    NEUTRAL_POSE,
    pose({
      rightWrist: { x: 0.75, y: 0.4 },
      rightElbow: { x: 0.7, y: 0.32 },
      leftWrist: { x: 0.3, y: 0.45 },
    }),
  ]),
  EAT: seq("EAT", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.52, y: 0.32 }, rightElbow: { x: 0.52, y: 0.38 } }),
  ]),
  STORE: seq("STORE", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.38, y: 0.5 },
      rightWrist: { x: 0.62, y: 0.5 },
    }),
  ]),
  SCHOOL: seq("SCHOOL", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.4, y: 0.35 },
      rightWrist: { x: 0.6, y: 0.35 },
      leftElbow: { x: 0.38, y: 0.28 },
      rightElbow: { x: 0.62, y: 0.28 },
    }),
  ]),
  HUNGRY: seq("HUNGRY", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.5, y: 0.38 }, leftWrist: { x: 0.48, y: 0.38 } }),
  ]),
  TIRED: seq("TIRED", [
    NEUTRAL_POSE,
    pose({
      head: { x: 0.5, y: 0.16 },
      rightWrist: { x: 0.55, y: 0.42 },
      leftWrist: { x: 0.45, y: 0.42 },
    }),
  ]),
  HOT: seq("HOT", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.35, y: 0.35 },
      rightWrist: { x: 0.65, y: 0.35 },
    }),
  ]),
  COLD: seq("COLD", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.42, y: 0.55 },
      rightWrist: { x: 0.58, y: 0.55 },
    }),
  ]),
  HELLO: seq("HELLO", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.68, y: 0.28 }, rightElbow: { x: 0.64, y: 0.22 } }),
    NEUTRAL_POSE,
  ]),
  THANK: seq("THANK", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.5, y: 0.38 }, leftWrist: { x: 0.48, y: 0.35 } }),
  ]),
  YES: seq("YES", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.55, y: 0.32 }, rightElbow: { x: 0.56, y: 0.28 } }),
  ]),
  NO: seq("NO", [
    NEUTRAL_POSE,
    pose({
      rightWrist: { x: 0.62, y: 0.38 },
      leftWrist: { x: 0.38, y: 0.38 },
    }),
  ]),
  VERY: seq("VERY", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.4, y: 0.4 },
      rightWrist: { x: 0.6, y: 0.4 },
    }),
  ]),
  TODAY: seq("TODAY", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.52, y: 0.35 }, leftWrist: { x: 0.48, y: 0.35 } }),
  ]),
  YESTERDAY: seq("YESTERDAY", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.55, y: 0.42 }, head: { x: 0.48, y: 0.12 } }),
  ]),
  TOMORROW: seq("TOMORROW", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.55, y: 0.28 }, head: { x: 0.52, y: 0.12 } }),
  ]),
  WEATHER: seq("WEATHER", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.38, y: 0.32 },
      rightWrist: { x: 0.62, y: 0.32 },
    }),
  ]),
  TIME: seq("TIME", [
    NEUTRAL_POSE,
    pose({ leftWrist: { x: 0.42, y: 0.38 }, rightWrist: { x: 0.58, y: 0.38 } }),
  ]),
  FEEL: seq("FEEL", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.52, y: 0.35 }, leftWrist: { x: 0.48, y: 0.35 } }),
  ]),
  HEADACHE: seq("HEADACHE", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.42, y: 0.18 },
      rightWrist: { x: 0.58, y: 0.18 },
      head: { x: 0.5, y: 0.14 },
    }),
  ]),
  FROM: seq("FROM", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.35, y: 0.4 }, rightElbow: { x: 0.4, y: 0.32 } }),
  ]),
  YOUR: seq("YOUR", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.58, y: 0.35 }, rightElbow: { x: 0.6, y: 0.28 } }),
  ]),
  MY: seq("MY", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.48, y: 0.32 }, rightElbow: { x: 0.5, y: 0.28 } }),
  ]),
  WANT: seq("WANT", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.55, y: 0.38 }, leftWrist: { x: 0.45, y: 0.4 } }),
  ]),
  NEED: seq("NEED", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.52, y: 0.35 }, leftWrist: { x: 0.48, y: 0.35 } }),
  ]),
  HELP: seq("HELP", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.5, y: 0.3 }, leftWrist: { x: 0.5, y: 0.42 } }),
  ]),
  WATER: seq("WATER", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.52, y: 0.38 }, leftWrist: { x: 0.48, y: 0.38 } }),
  ]),
  KNOW: seq("KNOW", [
    NEUTRAL_POSE,
    pose({ rightWrist: { x: 0.55, y: 0.28 }, head: { x: 0.5, y: 0.11 } }),
  ]),
  UNDERSTAND: seq("UNDERSTAND", [
    NEUTRAL_POSE,
    pose({
      rightWrist: { x: 0.58, y: 0.35 },
      leftWrist: { x: 0.42, y: 0.35 },
      head: { x: 0.5, y: 0.11 },
    }),
  ]),
  WHICH: seq("WHICH", [
    NEUTRAL_POSE,
    pose({ leftWrist: { x: 0.38, y: 0.4 }, rightWrist: { x: 0.62, y: 0.4 } }),
  ]),
  WORK: seq("WORK", [
    NEUTRAL_POSE,
    pose({
      leftWrist: { x: 0.42, y: 0.38 },
      rightWrist: { x: 0.58, y: 0.38 },
      rightElbow: { x: 0.6, y: 0.3 },
    }),
  ]),
};

export function getSignAnimation(word: string): SignPoseSequence | null {
  const key = word.toUpperCase().trim();
  return SIGN_DICTIONARY[key] ?? null;
}

/** Ensure every joint exists (guards partial/undefined poses during playback). */
export function normalizePose(p: SkeletonPose | Partial<SkeletonPose> | null | undefined): SkeletonPose {
  if (!p) return { ...NEUTRAL_POSE };
  return { ...NEUTRAL_POSE, ...p };
}

export function interpolatePose(
  a: SkeletonPose | null | undefined,
  b: SkeletonPose | null | undefined,
  t: number
): SkeletonPose {
  const poseA = normalizePose(a);
  const poseB = normalizePose(b);
  const u = Math.max(0, Math.min(1, t));

  const lerp = (p: SkeletonJoint, q: SkeletonJoint) => ({
    x: p.x + (q.x - p.x) * u,
    y: p.y + (q.y - p.y) * u,
  });

  const keys = Object.keys(NEUTRAL_POSE) as (keyof SkeletonPose)[];
  const result = {} as SkeletonPose;
  for (const k of keys) {
    result[k] = lerp(poseA[k], poseB[k]);
  }
  return result;
}
