"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { LandmarkFrame } from "@/types";
import {
  classifySignSequence,
  invalidateTemplateCache,
} from "@/features/translation/signClassifier";
import {
  saveUserTemplate,
  saveTrainingSample,
  getUserTemplateCount,
  exportTrainingData,
} from "@/services/storage/signTrainingStore";
import { getHandMotion } from "@/utils/gestureFeatures";

export interface PracticeChallenge {
  id: string;
  english: string;
  expectedGloss: string[];
}

export const PRACTICE_CHALLENGES: PracticeChallenge[] = [
  { id: "1", english: "What is your name?", expectedGloss: ["YOU", "NAME", "WHAT"] },
  { id: "2", english: "Are you hungry?", expectedGloss: ["YOU", "HUNGRY"] },
  { id: "3", english: "I am very tired.", expectedGloss: ["I", "TIRED", "VERY"] },
  { id: "4", english: "What time is it?", expectedGloss: ["TIME", "WHAT"] },
  { id: "5", english: "Where are you from?", expectedGloss: ["YOU", "FROM", "WHERE"] },
  { id: "6", english: "I have a headache.", expectedGloss: ["I", "FEEL", "HEADACHE"] },
  { id: "7", english: "The weather is hot today.", expectedGloss: ["TODAY", "WEATHER", "HOT"] },
  { id: "8", english: "Hello!", expectedGloss: ["HELLO"] },
];

export type PracticePhase = "idle" | "signing" | "scoring";

const PAUSE_MS = 900;
const MOTION_START = 0.018;

export function usePracticeMode() {
  const [challengeIndex, setChallengeIndex] = useState(0);
  const [phase, setPhase] = useState<PracticePhase>("idle");
  const [detectedWords, setDetectedWords] = useState<string[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [templateCount, setTemplateCount] = useState(0);

  const bufferRef = useRef<LandmarkFrame[]>([]);
  const prevFrameRef = useRef<LandmarkFrame | null>(null);
  const signingRef = useRef(false);
  const lastMotionRef = useRef(0);
  const signStartRef = useRef(0);
  const processingRef = useRef(false);

  const challenge = PRACTICE_CHALLENGES[challengeIndex];

  const refreshCount = useCallback(async () => {
    setTemplateCount(await getUserTemplateCount());
  }, []);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  const resetAttempt = useCallback(() => {
    bufferRef.current = [];
    prevFrameRef.current = null;
    signingRef.current = false;
    processingRef.current = false;
    setDetectedWords([]);
    setScore(null);
    setPhase("idle");
  }, []);

  const processFrame = useCallback(
    (frame: LandmarkFrame) => {
      if (processingRef.current || phase === "scoring") return;

      const motion = getHandMotion(frame, prevFrameRef.current);
      prevFrameRef.current = frame;

      if (!signingRef.current) {
        if (motion > MOTION_START) {
          signingRef.current = true;
          signStartRef.current = frame.timestamp;
          lastMotionRef.current = frame.timestamp;
          bufferRef.current = [frame];
          setPhase("signing");
        }
        return;
      }

      bufferRef.current.push(frame);
      if (motion > MOTION_START) lastMotionRef.current = frame.timestamp;

      const paused = frame.timestamp - lastMotionRef.current;
      const signed = frame.timestamp - signStartRef.current;

      if (paused >= PAUSE_MS && signed >= 400 && !processingRef.current) {
        processingRef.current = true;
        void (async () => {
          const frames = [...bufferRef.current];
          const { words } = await classifySignSequence(frames);
          setDetectedWords(words);
          setPhase("scoring");

          const expected = challenge.expectedGloss;
          let matches = 0;
          for (const w of words) {
            if (expected.includes(w)) matches++;
          }
          const pct = expected.length
            ? Math.round(
                ((matches / expected.length) * 0.7 +
                  (matches / Math.max(words.length, 1)) * 0.3) *
                  100
              )
            : 0;
          setScore(Math.min(100, pct));

          await saveTrainingSample(expected.join("_"), frames);
          processingRef.current = false;
          signingRef.current = false;
        })();
      }
    },
    [phase, challenge]
  );

  const trainSign = useCallback(
    async (word: string) => {
      if (bufferRef.current.length < 5) return;
      await saveUserTemplate(word, bufferRef.current, "practice");
      invalidateTemplateCache();
      await refreshCount();
    },
    [refreshCount]
  );

  const exportData = useCallback(async () => {
    const json = await exportTrainingData();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signbridge-training-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const nextChallenge = useCallback(() => {
    setChallengeIndex((i) => (i + 1) % PRACTICE_CHALLENGES.length);
    resetAttempt();
  }, [resetAttempt]);

  const prevChallenge = useCallback(() => {
    setChallengeIndex((i) => (i - 1 + PRACTICE_CHALLENGES.length) % PRACTICE_CHALLENGES.length);
    resetAttempt();
  }, [resetAttempt]);

  return {
    challengeIndex,
    challenge,
    phase,
    detectedWords,
    score,
    templateCount,
    nextChallenge,
    prevChallenge,
    resetAttempt,
    processFrame,
    trainSign,
    exportData,
  };
}
