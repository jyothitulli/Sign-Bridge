"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  CameraOff,
  ChevronLeft,
  ChevronRight,
  Download,
  Database,
  CheckCircle2,
} from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { useMediaPipe } from "@/hooks/useMediaPipe";
import { useCollectMode, type VocabularyPack } from "@/hooks/useCollectMode";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/cn";

const PACKS = [
  { id: "emergency", label: "Emergency & Safety" },
  { id: "daily", label: "Daily Conversation" },
] as const;

export default function CollectPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { settings } = useAppStore();
  const camera = useCamera();
  const mediapipe = useMediaPipe();

  const [packId, setPackId] = useState<(typeof PACKS)[number]["id"]>("emergency");
  const [vocabulary, setVocabulary] = useState<VocabularyPack | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const collect = useCollectMode(vocabulary);

  useEffect(() => {
    setLoadError(null);
    void fetch(`/vocabularies/${packId}.json`)
      .then((r) => {
        if (!r.ok) throw new Error("Vocabulary not found");
        return r.json();
      })
      .then(setVocabulary)
      .catch(() => setLoadError("Could not load vocabulary pack"));
  }, [packId]);

  const cameraActiveRef = useRef(false);
  cameraActiveRef.current = camera.isActive;

  useEffect(() => {
    mediapipe.setFrameListener((frame) => {
      if (cameraActiveRef.current && mediapipe.status === "ready") {
        collect.processFrame(frame);
      }
    });
    return () => mediapipe.setFrameListener(null);
  }, [collect.processFrame, mediapipe.setFrameListener, mediapipe.status]);

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
      collect.resetClip();
    } else {
      await camera.startCamera(settings.cameraResolution);
    }
  }, [camera, mediapipe, collect, settings.cameraResolution]);

  const progressPct = collect.targetReps
    ? Math.min(100, Math.round((collect.currentCount / collect.targetReps) * 100))
    : 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-xl">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          Data Collection
        </h1>
        <p className="text-sm text-muted-foreground">
          Record each sign {collect.targetReps} times — this is how you reach real-world accuracy.
          Sign the word, pause 1 second, repeat.
        </p>
      </motion.div>

      <div className="flex gap-2 mb-4">
        {PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPackId(p.id)}
            className={cn(
              "flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
              packId === p.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loadError && (
        <p className="text-sm text-rose-400 mb-4">{loadError}</p>
      )}

      {vocabulary && (
        <div className="glass rounded-2xl p-5 mb-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Pack progress: {collect.completedWords}/{collect.totalWords} words at target
            </span>
            <span>
              {collect.wordIndex + 1}/{collect.totalWords}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <button type="button" onClick={collect.prevWord} className="p-2 rounded-lg hover:bg-muted">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center">
              <p className="text-3xl font-bold tracking-wide">{collect.currentWord}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {collect.currentCount}/{collect.targetReps} recordings
              </p>
            </div>
            <button type="button" onClick={collect.nextWord} className="p-2 rounded-lg hover:bg-muted">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="relative rounded-2xl overflow-hidden bg-card border border-border aspect-[4/3] mb-4">
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" width={640} height={480} />

        {!camera.isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-card">
            <CameraOff className="h-8 w-8 text-muted-foreground" />
          </div>
        )}

        {collect.phase === "signing" && (
          <div className="absolute top-3 left-3 bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full animate-pulse">
            Recording…
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

      <AnimatePresence mode="wait">
        {collect.phase === "saved" && collect.lastSavedWord && (
          <motion.div
            key="saved"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-4 mb-4 flex items-center gap-3 text-sm"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-medium">Saved &quot;{collect.lastSavedWord}&quot;</p>
              <p className="text-xs text-muted-foreground">
                {collect.counts[collect.lastSavedWord] ?? 0}/{collect.targetReps} — sign again or tap Next word
              </p>
            </div>
            <button
              type="button"
              onClick={collect.resetClip}
              className="ml-auto text-xs border border-border rounded-lg px-3 py-1.5"
            >
              Next rep
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="glass rounded-xl p-4 space-y-3 text-sm">
        <p className="font-semibold">Training workflow</p>
        <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
          <li>Record 50 reps per word (vary speed, distance, angle slightly)</li>
          <li>Ask 2–3 other people to record the same words on their devices</li>
          <li>Export JSON from each device → merge with Python</li>
          <li>Run <code className="text-foreground">train_lstm.py</code> → deploy model.json</li>
        </ol>
        <button
          type="button"
          onClick={() => collect.exportData()}
          className="flex items-center gap-2 text-xs text-primary hover:underline"
        >
          <Download className="h-3.5 w-3.5" />
          Export all training data (JSON)
        </button>
      </div>
    </div>
  );
}
