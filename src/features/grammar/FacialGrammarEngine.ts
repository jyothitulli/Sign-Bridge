// Facial non-manual signals → grammar tags for English generation.
// Complements hand-based gloss recognition (QuestionDetector + head/mouth cues).

import type { FacialGrammarTag, LandmarkFrame, Point3D, QuestionType } from "@/types";
import { QuestionDetector } from "@/features/grammar/QuestionDetector";

export interface FacialGrammarResult {
  tags: FacialGrammarTag[];
  questionType: QuestionType;
  confidence: number;
  eyebrowHeight: number;
}

const NOSE_TIP = 1;
const HEAD_SHAKE_MIN_OSCILLATIONS = 2;
const HEAD_SHAKE_WINDOW_MS = 600;

function noseYaw(landmarks: Point3D[]): number {
  if (!landmarks[NOSE_TIP]) return 0;
  return landmarks[NOSE_TIP].x;
}

function mouthOpenness(landmarks: Point3D[]): number {
  const upper = landmarks[13];
  const lower = landmarks[14];
  if (!upper || !lower) return 0;
  return Math.abs(lower.y - upper.y);
}

function detectHeadShake(frames: LandmarkFrame[]): boolean {
  const xs: { x: number; t: number }[] = [];
  for (const f of frames) {
    if (!f.faceLandmarks?.length) continue;
    xs.push({ x: noseYaw(f.faceLandmarks), t: f.timestamp });
  }
  if (xs.length < 8) return false;

  const span = xs[xs.length - 1].t - xs[0].t;
  if (span < HEAD_SHAKE_WINDOW_MS * 0.5) return false;

  let direction = 0;
  let oscillations = 0;
  for (let i = 1; i < xs.length; i++) {
    const delta = xs[i].x - xs[i - 1].x;
    if (Math.abs(delta) < 0.008) continue;
    const sign = delta > 0 ? 1 : -1;
    if (direction !== 0 && sign !== direction) oscillations++;
    direction = sign;
  }
  return oscillations >= HEAD_SHAKE_MIN_OSCILLATIONS;
}

export class FacialGrammarEngine {
  static resetSession(): void {
    QuestionDetector.resetCalibration();
  }

  static calibrateFrame(frame: LandmarkFrame): void {
    QuestionDetector.calibrate(frame);
  }

  /**
   * Analyze a signing clip and return grammar tags + question type.
   */
  static analyze(frames: LandmarkFrame[]): FacialGrammarResult {
    const face = QuestionDetector.analyzeBuffer(frames);
    const tags: FacialGrammarTag[] = [];

    if (face.questionType === "YES_NO" && face.confidence > 0.45) {
      tags.push("YES_NO_Q");
    } else if (face.questionType === "WH" && face.confidence > 0.4) {
      tags.push("WH_Q");
    }

    if (detectHeadShake(frames)) {
      tags.push("NEGATION");
    }

    const mouthSamples = frames
      .filter((f) => f.faceLandmarks?.length > 100)
      .map((f) => mouthOpenness(f.faceLandmarks));
    if (mouthSamples.length > 0) {
      const avgMouth = mouthSamples.reduce((a, b) => a + b, 0) / mouthSamples.length;
      if (avgMouth > 0.055 && face.questionType === "STATEMENT") {
        tags.push("RHETORICAL");
      }
    }

    if (tags.length === 0) tags.push("NEUTRAL");

    return {
      tags,
      questionType: face.questionType,
      confidence: face.confidence,
      eyebrowHeight: face.eyebrowHeight,
    };
  }

  /** Insert NOT gloss when headshake negation detected. */
  static applyNegationToGloss(words: string[]): string[] {
    if (words.includes("NOT")) return words;

    const subjects = ["I", "YOU", "HE", "SHE", "WE", "THEY", "IT"];
    const idx = words.findIndex((w) => subjects.includes(w));
    if (idx >= 0) {
      const next = [...words];
      next.splice(idx + 1, 0, "NOT");
      return next;
    }
    return [...words, "NOT"];
  }

  static resolveQuestionType(
    facial: FacialGrammarResult,
    glossWords: string[]
  ): QuestionType {
    const whInGloss = glossWords.some((w) =>
      ["WHAT", "WHERE", "WHEN", "WHY", "WHO", "HOW", "WHICH"].includes(w)
    );
    if (whInGloss) return "WH";
    if (facial.tags.includes("WH_Q") && facial.confidence > 0.4) return "WH";
    if (facial.tags.includes("YES_NO_Q") && facial.confidence > 0.45) return "YES_NO";
    if (facial.confidence > 0.5) return facial.questionType;
    return "STATEMENT";
  }
}
