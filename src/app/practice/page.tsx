"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  Star,
  RefreshCw,
} from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { useMediaPipe } from "@/hooks/useMediaPipe";
import { usePracticeMode } from "@/hooks/usePracticeMode";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/cn";

export default function PracticePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { settings } = useAppStore();
  const camera = useCamera();
  const mediapipe = useMediaPipe();
  const practice = usePracticeMode();

  const cameraActiveRef = useRef(false);
  cameraActiveRef.current = camera.isActive;

  useEffect(() => {
    mediapipe.setFrameListener((frame) => {
      if (cameraActiveRef.current && mediapipe.status === "ready") {
        practice.processFrame(frame);
      }
    });
    return () => mediapipe.setFrameListener(null);
  }, [practice.processFrame, mediapipe.setFrameListener, mediapipe.status]);

  useEffect(() => {
    if (
      camera.isActive &&
      videoRef.current &&
      canvasRef.current &&
      mediapipe.status === "not_loaded"
    ) {
      mediapipe.startDetection(videoRef.current, canvasRef.current);
    }
  }, [camera.isActive, mediapipe.status, mediapipe.startDetection]);

  const handleCameraToggle = useCallback(async () => {
    if (camera.isActive) {
      camera.stopCamera();
      mediapipe.stopDetection();
      practice.resetAttempt();
    } else {
      await camera.startCamera(settings.cameraResolution);
    }
  }, [camera, mediapipe, practice, settings.cameraResolution]);

  const scoreColor =
    practice.score === null
      ? "text-muted-foreground"
      : practice.score >= 80
        ? "text-emerald-400"
        : practice.score >= 50
          ? "text-amber-400"
          : "text-rose-400";

  return (
    <div className="container mx-auto px-4 py-6 max-w-xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          Practice Mode
        </h1>
        <p className="text-sm text-muted-foreground">
          Sign the sentence below — score improves as you train custom templates.
        </p>
      </motion.div>

      {/* Challenge card */}
      <div className="glass rounded-2xl p-5 mb-4 space-y-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={practice.prevChallenge} className="p-2 rounded-lg hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-xs text-muted-foreground">
            {practice.challengeIndex + 1} / 8
          </span>
          <button type="button" onClick={practice.nextChallenge} className="p-2 rounded-lg hover:bg-muted">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xl font-semibold text-center leading-snug">
          {practice.challenge.english}
        </p>
        <p className="text-center text-xs font-mono text-muted-foreground">
          Expected: {practice.challenge.expectedGloss.join(" + ")}
        </p>
      </div>

      {/* Camera */}
      <div className="relative rounded-2xl overflow-hidden bg-card border border-border aspect-[4/3] mb-4">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" width={640} height={480} />

        {!camera.isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <CameraOff className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {practice.phase === "signing" && (
          <div className="absolute top-3 left-3 bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full animate-pulse">
            Signing…
          </div>
        )}
      </div>

      <div className="flex justify-center mb-4">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleCameraToggle}
          className={cn(
            "flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold",
            camera.isActive ? "bg-muted" : "gradient-brand text-white glow-primary"
          )}
        >
          {camera.isActive ? <CameraOff className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
          {camera.isActive ? "Stop Camera" : "Start Camera"}
        </motion.button>
      </div>

      {/* Score */}
      <AnimatePresence mode="wait">
        {practice.phase === "scoring" && (
          <motion.div
            key="score"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 mb-4 text-center space-y-3"
          >
            <Star className={cn("h-10 w-10 mx-auto", scoreColor)} />
            <p className={cn("text-4xl font-bold", scoreColor)}>{practice.score}%</p>
            <p className="text-sm text-muted-foreground">Match score</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {practice.detectedWords.map((w) => (
                <span
                  key={w}
                  className={cn(
                    "text-xs font-mono px-2 py-1 rounded-lg border",
                    practice.challenge.expectedGloss.includes(w)
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {w}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 justify-center pt-2">
              {practice.challenge.expectedGloss.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => practice.trainSign(word)}
                  className="text-xs rounded-lg border border-primary/30 px-3 py-1.5 hover:bg-primary/10 text-primary"
                >
                  Train &quot;{word}&quot; from this clip
                </button>
              ))}
              <button
                type="button"
                onClick={practice.resetAttempt}
                className="text-xs rounded-lg border border-border px-3 py-1.5 flex items-center gap-1"
              >
                <RefreshCw className="h-3 w-3" /> Try again
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Training stats */}
      <div className="glass rounded-xl p-4 space-y-3 text-sm">
        <p className="font-semibold">Improve accuracy</p>
        <p className="text-xs text-muted-foreground">
          After signing, click <strong>Train &quot;WORD&quot;</strong> for personal templates.
          To skip recording entirely, use <strong>TRAINING_NO_RECORDING.md</strong> in the project (WLASL download + train).
        </p>
        <p className="text-xs text-muted-foreground">
          Custom templates saved: <strong>{practice.templateCount}</strong>
        </p>
        <button
          type="button"
          onClick={() => practice.exportData()}
          className="flex items-center gap-2 text-xs text-primary hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Export training data for LSTM (Python)
        </button>
      </div>
    </div>
  );
}
