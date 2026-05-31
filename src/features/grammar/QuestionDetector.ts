// src/features/grammar/QuestionDetector.ts
// Detects question type from MediaPipe face landmarks (eyebrow position).
// Raised eyebrows = YES/NO question
// Furrowed (lowered) eyebrows = WH-question
// Neutral = Statement

import type { FaceExpressionResult, LandmarkFrame, Point3D, QuestionType } from "@/types";

// ─── MediaPipe Face Landmark Indices ─────────────────────────────────────────
// These are the specific face mesh point indices for eyebrows
// Reference: https://developers.google.com/mediapipe/solutions/vision/face_landmarker

const LEFT_EYEBROW_UPPER  = [336, 296, 334, 293, 300]; // top edge of left eyebrow
const LEFT_EYEBROW_LOWER  = [285, 295, 282, 283, 276]; // bottom edge
const RIGHT_EYEBROW_UPPER = [107, 66,  105, 63,  70 ]; // top edge of right eyebrow
const RIGHT_EYEBROW_LOWER = [55,  65,  52,  53,  46 ]; // bottom edge

const _LEFT_EYE_CENTER     = 468; // iris center (precise reference)
const _RIGHT_EYE_CENTER    = 473;
const LEFT_EYE_TOP        = 386; // eyelid top
const RIGHT_EYE_TOP       = 159;

// ─── Helper ───────────────────────────────────────────────────────────────────

function avgY(landmarks: Point3D[], indices: number[]): number {
  const validPoints = indices
    .filter(i => i < landmarks.length)
    .map(i => landmarks[i]);
  if (validPoints.length === 0) return 0;
  return validPoints.reduce((sum, p) => sum + p.y, 0) / validPoints.length;
}

function getEyebrowHeight(landmarks: Point3D[]): {
  leftHeight: number;
  rightHeight: number;
  avgHeight: number;
} {
  if (!landmarks || landmarks.length < 10) {
    return { leftHeight: 0, rightHeight: 0, avgHeight: 0 };
  }

  // Eye center Y positions (reference baseline)
  const leftEyeY  = landmarks[LEFT_EYE_TOP]?.y  ?? 0;
  const rightEyeY = landmarks[RIGHT_EYE_TOP]?.y ?? 0;

  // Eyebrow average Y positions
  const leftBrowY  = avgY(landmarks, [...LEFT_EYEBROW_UPPER,  ...LEFT_EYEBROW_LOWER]);
  const rightBrowY = avgY(landmarks, [...RIGHT_EYEBROW_UPPER, ...RIGHT_EYEBROW_LOWER]);

  // In MediaPipe, Y=0 is top, Y=1 is bottom (image coords).
  // So raised eyebrow = SMALLER Y value.
  // height = eyeY - browY → positive = raised, negative = furrowed
  const leftHeight  = leftEyeY  - leftBrowY;
  const rightHeight = rightEyeY - rightBrowY;
  const avgHeight   = (leftHeight + rightHeight) / 2;

  return { leftHeight, rightHeight, avgHeight };
}

// ─── Thresholds ───────────────────────────────────────────────────────────────
// These values are normalized (0–1 range in MediaPipe coords).
// Tune these after testing with real camera input.

const RAISED_THRESHOLD   =  0.045; // above neutral = YES/NO question
const FURROWED_THRESHOLD = -0.010; // below neutral = WH-question (slight furrowing)
const CONFIDENCE_SCALE   =  200;   // multiplier for confidence score

// ─── Main Export ──────────────────────────────────────────────────────────────

export class QuestionDetector {
  private static baseline: number | null = null;
  private static samples: number[] = [];

  /**
   * Calibrate baseline from first few frames (neutral face).
   * Call this at the start of each recording session.
   */
  static calibrate(frame: LandmarkFrame): void {
    if (!frame.faceLandmarks?.length) return;
    const { avgHeight } = getEyebrowHeight(frame.faceLandmarks);
    this.samples.push(avgHeight);
    if (this.samples.length >= 5) {
      this.baseline = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
      this.samples = [];
    }
  }

  /**
   * Reset calibration (call when starting new session).
   */
  static resetCalibration(): void {
    this.baseline = null;
    this.samples = [];
  }

  /**
   * Detect question type from a single face landmark frame.
   */
  static detectFromFrame(frame: LandmarkFrame): FaceExpressionResult {
    if (!frame.faceLandmarks?.length) {
      return { questionType: "STATEMENT", eyebrowHeight: 0, confidence: 0 };
    }
    return this.detectFromLandmarks(frame.faceLandmarks);
  }

  /**
   * Detect question type from raw face landmarks array.
   * This is the main method you'll call per frame.
   */
  static detectFromLandmarks(faceLandmarks: Point3D[]): FaceExpressionResult {
    if (!faceLandmarks || faceLandmarks.length < 100) {
      return { questionType: "STATEMENT", eyebrowHeight: 0, confidence: 0 };
    }

    const { avgHeight } = getEyebrowHeight(faceLandmarks);

    // Adjust relative to baseline if calibrated
    const adjustedHeight = this.baseline !== null
      ? avgHeight - this.baseline
      : avgHeight - 0.06; // rough default baseline

    let questionType: QuestionType;
    let confidence: number;

    if (adjustedHeight > RAISED_THRESHOLD) {
      // Raised eyebrows = YES/NO question (e.g., "Are you hungry?")
      questionType = "YES_NO";
      confidence = Math.min(1, (adjustedHeight - RAISED_THRESHOLD) * CONFIDENCE_SCALE);
    } else if (adjustedHeight < FURROWED_THRESHOLD) {
      // Furrowed eyebrows = WH-question (e.g., "What is your name?")
      questionType = "WH";
      confidence = Math.min(1, (FURROWED_THRESHOLD - adjustedHeight) * CONFIDENCE_SCALE);
    } else {
      // Neutral = statement
      questionType = "STATEMENT";
      confidence = Math.min(1, 1 - Math.abs(adjustedHeight) * CONFIDENCE_SCALE);
    }

    return {
      questionType,
      eyebrowHeight: adjustedHeight,
      confidence: Math.max(0, confidence),
    };
  }

  /**
   * Analyze multiple frames and return the most likely question type.
   * Use this on the full recording buffer for a more stable result.
   */
  static analyzeBuffer(frames: LandmarkFrame[]): FaceExpressionResult {
    if (!frames || frames.length === 0) {
      return { questionType: "STATEMENT", eyebrowHeight: 0, confidence: 0 };
    }

    const results = frames
      .filter(f => f.faceLandmarks?.length > 100)
      .map(f => this.detectFromLandmarks(f.faceLandmarks));

    if (results.length === 0) {
      return { questionType: "STATEMENT", eyebrowHeight: 0, confidence: 0 };
    }

    // Count votes
    const votes: Record<QuestionType, number> = {
      WH: 0, YES_NO: 0, STATEMENT: 0,
    };
    let totalHeight = 0;

    for (const r of results) {
      votes[r.questionType] += r.confidence;
      totalHeight += r.eyebrowHeight;
    }

    // Find winner
    const winner = (Object.entries(votes) as [QuestionType, number][])
      .sort((a, b) => b[1] - a[1])[0];

    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

    return {
      questionType: winner[0],
      eyebrowHeight: totalHeight / results.length,
      confidence: totalVotes > 0 ? winner[1] / totalVotes : 0,
    };
  }
}