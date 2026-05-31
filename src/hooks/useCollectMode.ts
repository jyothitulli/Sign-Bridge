"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { LandmarkFrame } from "@/types";
import {
  saveTrainingSample,
  saveUserTemplate,
  getSampleCountsByWord,
  exportTrainingData,
} from "@/services/storage/signTrainingStore";
import { invalidateTemplateCache } from "@/features/translation/signClassifier";
import { getHandMotion } from "@/utils/gestureFeatures";

export interface VocabularyPack {
  id: string;
  name: string;
  description: string;
  targetRepsPerWord: number;
  words: string[];
}

const PAUSE_MS = 900;
const MOTION_START = 0.018;
const MIN_SIGN_MS = 350;

export type CollectPhase = "ready" | "signing" | "saved";

export function useCollectMode(vocabulary: VocabularyPack | null) {
  const [wordIndex, setWordIndex] = useState(0);
  const [phase, setPhase] = useState<CollectPhase>("ready");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [lastSavedWord, setLastSavedWord] = useState<string | null>(null);

  const bufferRef = useRef<LandmarkFrame[]>([]);
  const prevFrameRef = useRef<LandmarkFrame | null>(null);
  const signingRef = useRef(false);
  const lastMotionRef = useRef(0);
  const signStartRef = useRef(0);
  const processingRef = useRef(false);

  const currentWord = vocabulary?.words[wordIndex] ?? null;
  const targetReps = vocabulary?.targetRepsPerWord ?? 50;
  const currentCount = currentWord ? counts[currentWord] ?? 0 : 0;

  const refreshCounts = useCallback(async () => {
    setCounts(await getSampleCountsByWord());
  }, []);

  useEffect(() => {
    void refreshCounts();
  }, [refreshCounts]);

  const resetClip = useCallback(() => {
    bufferRef.current = [];
    prevFrameRef.current = null;
    signingRef.current = false;
    processingRef.current = false;
    setPhase("ready");
    setLastSavedWord(null);
  }, []);

  const processFrame = useCallback(
    (frame: LandmarkFrame) => {
      if (!currentWord || processingRef.current) return;

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

      if (paused >= PAUSE_MS && signed >= MIN_SIGN_MS && !processingRef.current) {
        processingRef.current = true;
        void (async () => {
          const frames = [...bufferRef.current];
          await saveTrainingSample(currentWord, frames);
          await saveUserTemplate(currentWord, frames, "manual");
          invalidateTemplateCache();
          await refreshCounts();
          setLastSavedWord(currentWord);
          setPhase("saved");
          processingRef.current = false;
          signingRef.current = false;
        })();
      }
    },
    [currentWord, refreshCounts]
  );

  const nextWord = useCallback(() => {
    if (!vocabulary) return;
    setWordIndex((i) => (i + 1) % vocabulary.words.length);
    resetClip();
  }, [vocabulary, resetClip]);

  const prevWord = useCallback(() => {
    if (!vocabulary) return;
    setWordIndex((i) => (i - 1 + vocabulary.words.length) % vocabulary.words.length);
    resetClip();
  }, [vocabulary, resetClip]);

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

  const completedWords = vocabulary
    ? vocabulary.words.filter((w) => (counts[w] ?? 0) >= targetReps).length
    : 0;

  return {
    wordIndex,
    currentWord,
    currentCount,
    targetReps,
    phase,
    counts,
    lastSavedWord,
    completedWords,
    totalWords: vocabulary?.words.length ?? 0,
    processFrame,
    nextWord,
    prevWord,
    resetClip,
    exportData,
    refreshCounts,
  };
}
