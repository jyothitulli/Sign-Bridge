"use client";

import { useRef, useState, useCallback } from "react";
import type { LandmarkFrame, TranslationResult } from "@/types";
import { translateFrames } from "@/features/translation";
import { QuestionDetector } from "@/features/grammar";
import { classifyPartialSequence } from "@/features/translation/signClassifier";
import { getHandMotion, handsVisible } from "@/utils/gestureFeatures";
import { useAppStore } from "@/stores/appStore";
import { api } from "@/services/api/client";
import { useAuthStore } from "@/stores/authStore";

const MAX_FRAMES = 300;
const MIN_FRAMES = 12;
const MOTION_START = 0.018;
const PAUSE_MS = 900;
const MIN_SIGN_MS = 400;
const PREVIEW_INTERVAL = 12;

export type LiveState = "listening" | "signing" | "processing";

export interface LivePreview {
  confirmed: string[];
  current: string | null;
  currentConfidence: number;
}

interface UseSignTranslationReturn {
  liveState: LiveState;
  currentResult: TranslationResult | null;
  recentResults: TranslationResult[];
  livePreview: LivePreview;
  processFrame: (frame: LandmarkFrame) => void;
  clearResults: () => void;
  recordingState: "idle" | "recording" | "processing" | "done";
  frameCount: number;
  addFrame: (frame: LandmarkFrame) => void;
  clearResult: () => void;
}

export function useSignTranslation(): UseSignTranslationReturn {
  const [liveState, setLiveState] = useState<LiveState>("listening");
  const [currentResult, setCurrentResult] = useState<TranslationResult | null>(null);
  const [recentResults, setRecentResults] = useState<TranslationResult[]>([]);
  const [frameCount, setFrameCount] = useState(0);
  const [livePreview, setLivePreview] = useState<LivePreview>({
    confirmed: [],
    current: null,
    currentConfidence: 0,
  });

  const bufferRef = useRef<LandmarkFrame[]>([]);
  const prevFrameRef = useRef<LandmarkFrame | null>(null);
  const isSigningRef = useRef(false);
  const signStartRef = useRef(0);
  const lastMotionRef = useRef(0);
  const processingRef = useRef(false);
  const previewBusyRef = useRef(false);

  const { addTranslation, addMessage, activeSession, startNewSession, settings } =
    useAppStore();
  const token = useAuthStore((s) => s.token);

  const resetPreview = useCallback(() => {
    setLivePreview({ confirmed: [], current: null, currentConfidence: 0 });
  }, []);

  const updateLivePreview = useCallback(
    async (frames: LandmarkFrame[]) => {
      if (!settings.showLivePreview || previewBusyRef.current || frames.length < 12) return;
      previewBusyRef.current = true;
      try {
        const partial = await classifyPartialSequence(frames);
        setLivePreview(partial);
      } finally {
        previewBusyRef.current = false;
      }
    },
    [settings.showLivePreview]
  );

  const syncMessageToCloud = useCallback(
    async (message: Parameters<typeof addMessage>[0]) => {
      if (!token) return;
      try {
        const session = useAppStore.getState().activeSession;
        if (session) {
          await api.syncPush(token, [
            {
              id: session.id,
              messages: [...session.messages, message],
              createdAt: session.createdAt,
              updatedAt: Date.now(),
            },
          ]);
        }
      } catch {
        // Offline or API down — local history still works
      }
    },
    [token]
  );

  const finalizeTranslation = useCallback(
    async (frames: LandmarkFrame[]) => {
      if (processingRef.current || frames.length < MIN_FRAMES) return;
      processingRef.current = true;
      setLiveState("processing");
      resetPreview();

      try {
        const result = await translateFrames({ frames });

        setCurrentResult(result);
        setRecentResults((prev) => [result, ...prev].slice(0, 10));
        addTranslation(result);

        if (!activeSession) startNewSession();
        const msg = {
          id: result.id,
          type: "signed" as const,
          rawWords: result.rawWords,
          sentence: result.correctedSentence,
          timestamp: result.timestamp,
          confidence: result.confidence,
        };
        addMessage(msg);
        void syncMessageToCloud(msg);

        if (settings.autoSpeak && typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(result.correctedSentence);
          u.rate = 0.9;
          window.speechSynthesis.speak(u);
        }
      } catch (err) {
        console.error("[useSignTranslation]", err);
      } finally {
        bufferRef.current = [];
        prevFrameRef.current = null;
        isSigningRef.current = false;
        setFrameCount(0);
        processingRef.current = false;
        setLiveState("listening");
        QuestionDetector.resetCalibration();
      }
    },
    [
      addTranslation,
      addMessage,
      activeSession,
      startNewSession,
      settings.autoSpeak,
      resetPreview,
      syncMessageToCloud,
    ]
  );

  const processFrame = useCallback(
    (frame: LandmarkFrame) => {
      if (processingRef.current) return;

      const now = frame.timestamp;
      const motion = getHandMotion(frame, prevFrameRef.current);
      prevFrameRef.current = frame;

      const handsUp = handsVisible(frame);
      const moving = motion > MOTION_START;

      if (!isSigningRef.current) {
        if (handsUp && moving) {
          isSigningRef.current = true;
          signStartRef.current = now;
          lastMotionRef.current = now;
          bufferRef.current = [frame];
          setFrameCount(1);
          setLiveState("signing");
          resetPreview();
          QuestionDetector.resetCalibration();
          QuestionDetector.calibrate(frame);
        }
        return;
      }

      if (bufferRef.current.length < MAX_FRAMES) {
        bufferRef.current.push(frame);
        const count = bufferRef.current.length;
        setFrameCount(count);
        if (count <= 8) QuestionDetector.calibrate(frame);

        if (settings.showLivePreview && count % PREVIEW_INTERVAL === 0) {
          void updateLivePreview([...bufferRef.current]);
        }
      }

      if (moving) lastMotionRef.current = now;

      const pausedFor = now - lastMotionRef.current;
      const signedFor = now - signStartRef.current;

      if (pausedFor >= PAUSE_MS && signedFor >= MIN_SIGN_MS) {
        void finalizeTranslation([...bufferRef.current]);
      }
    },
    [finalizeTranslation, resetPreview, settings.showLivePreview, updateLivePreview]
  );

  const clearResults = useCallback(() => {
    setCurrentResult(null);
    setRecentResults([]);
    setLiveState("listening");
    resetPreview();
  }, [resetPreview]);

  const recordingState =
    liveState === "signing"
      ? "recording"
      : liveState === "processing"
        ? "processing"
        : currentResult
          ? "done"
          : "idle";

  return {
    liveState,
    currentResult,
    recentResults,
    livePreview,
    processFrame,
    clearResults,
    recordingState,
    frameCount,
    addFrame: processFrame,
    clearResult: clearResults,
  };
}
