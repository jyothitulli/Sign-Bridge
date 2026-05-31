// Normalized hand/body features for sign classification (CPU-only, no LSTM).

import type { LandmarkFrame, Point3D } from "@/types";

export interface GestureFeatures {
  /** Wrist position relative to shoulder center (normalized by shoulder width) */
  rightWristRelX: number;
  rightWristRelY: number;
  leftWristRelX: number;
  leftWristRelY: number;
  bothHandsActive: boolean;
  rightHandActive: boolean;
  leftHandActive: boolean;
  /** Thumb–index spread on dominant hand (0–1 scale) */
  fingerSpread: number;
  /** Hands near face region */
  nearFace: boolean;
  /** Hands at stomach / lower chest */
  lowHands: boolean;
  /** Wrists close together (two-hand signs) */
  wristsTogether: boolean;
}

export function getHandMotion(current: LandmarkFrame, previous: LandmarkFrame | null): number {
  if (!previous) return 0;
  let motion = 0;

  const pairs: [Point3D[] | undefined, Point3D[] | undefined][] = [
    [current.rightHandLandmarks, previous.rightHandLandmarks],
    [current.leftHandLandmarks, previous.leftHandLandmarks],
  ];

  for (const [curr, prev] of pairs) {
    if (!curr || !prev || curr.length < 21 || prev.length < 21) continue;
    for (let i = 0; i < 21; i++) {
      motion += Math.abs(curr[i].x - prev[i].x) + Math.abs(curr[i].y - prev[i].y);
    }
  }
  return motion;
}

export function handsVisible(frame: LandmarkFrame): boolean {
  return (
    (frame.rightHandLandmarks?.length ?? 0) >= 21 ||
    (frame.leftHandLandmarks?.length ?? 0) >= 21
  );
}

export function extractGestureFeatures(frame: LandmarkFrame): GestureFeatures | null {
  const pose = frame.poseLandmarks;
  if (!pose || pose.length < 13) return null;

  const ls = pose[11];
  const rs = pose[12];
  const nose = pose[0];
  if (!ls || !rs || !nose) return null;

  const centerX = (ls.x + rs.x) / 2;
  const shoulderY = (ls.y + rs.y) / 2;
  const scale = Math.max(Math.abs(rs.x - ls.x), 0.12);

  const rw = frame.rightHandLandmarks?.[0];
  const lw = frame.leftHandLandmarks?.[0];
  const rIndex = frame.rightHandLandmarks?.[8];
  const rThumb = frame.rightHandLandmarks?.[4];
  const lIndex = frame.leftHandLandmarks?.[8];
  const lThumb = frame.leftHandLandmarks?.[4];

  const rightHandActive = !!rw;
  const leftHandActive = !!lw;

  const rel = (p: Point3D) => ({
    x: (p.x - centerX) / scale,
    y: (p.y - shoulderY) / scale,
  });

  const rwRel = rw ? rel(rw) : { x: 0, y: 0 };
  const lwRel = lw ? rel(lw) : { x: 0, y: 0 };

  let fingerSpread = 0;
  if (rIndex && rThumb) {
    fingerSpread = Math.hypot(rIndex.x - rThumb.x, rIndex.y - rThumb.y) / scale;
  } else if (lIndex && lThumb) {
    fingerSpread = Math.hypot(lIndex.x - lThumb.x, lIndex.y - lThumb.y) / scale;
  }

  const faceY = nose.y;
  const nearFace =
    (rw && rw.y < faceY + 0.08) || (lw && lw.y < faceY + 0.08);

  const lowHands =
    (rw && rw.y > shoulderY + scale * 0.35) || (lw && lw.y > shoulderY + scale * 0.35);

  const wristsTogether =
    rw && lw ? Math.hypot(rw.x - lw.x, rw.y - lw.y) / scale < 0.55 : false;

  return {
    rightWristRelX: rwRel.x,
    rightWristRelY: rwRel.y,
    leftWristRelX: lwRel.x,
    leftWristRelY: lwRel.y,
    bothHandsActive: rightHandActive && leftHandActive,
    rightHandActive,
    leftHandActive,
    fingerSpread,
    nearFace,
    lowHands,
    wristsTogether,
  };
}
