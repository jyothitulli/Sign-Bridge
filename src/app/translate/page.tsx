// src/app/translate/page.tsx
// Continuous translation: camera on top, sentence appears below when you pause signing.

"use client";

import { useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, CameraOff, Zap, AlertTriangle, Hand, Sparkles } from "lucide-react";
import { useCamera } from "@/hooks/useCamera";
import { useMediaPipe } from "@/hooks/useMediaPipe";
import { useSignTranslation } from "@/hooks/useSignTranslation";
import { SentenceOutput } from "@/components/translation/SentenceOutput";
import { LivePreviewBar } from "@/components/translation/LivePreviewBar";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/cn";

export default function TranslatePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { settings } = useAppStore();
  const camera = useCamera();
  const mediapipe = useMediaPipe();
  const translation = useSignTranslation();

  const cameraActiveRef = useRef(false);
  cameraActiveRef.current = camera.isActive;

  // Feed every frame to continuous detector when camera is live
  useEffect(() => {
    mediapipe.setFrameListener((frame) => {
      if (cameraActiveRef.current && mediapipe.status === "ready") {
        translation.processFrame(frame);
      }
    });
    return () => mediapipe.setFrameListener(null);
  }, [translation.processFrame, mediapipe.setFrameListener, mediapipe.status]);

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
    } else {
      await camera.startCamera(settings.cameraResolution);
    }
  }, [camera, mediapipe, settings.cameraResolution]);

  const isSigning = translation.liveState === "signing";
  const isProcessing = translation.liveState === "processing";
  const isListening = translation.liveState === "listening" && camera.isActive;

  return (
    <div className="container mx-auto px-4 py-6 max-w-xl">

      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5 text-center"
      >
        <h1 className="text-2xl font-bold mb-1">Sign Language Translator</h1>
        <p className="text-sm text-muted-foreground">
          Start the camera, sign naturally, then pause — your sentence appears below.
        </p>
      </motion.div>

      <div className="space-y-4">

        {/* Camera */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative rounded-2xl overflow-hidden bg-card border border-border aspect-[4/3] shadow-lg"
        >
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover opacity-0 pointer-events-none"
            playsInline
            muted
            autoPlay
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            width={640}
            height={480}
          />

          <AnimatePresence>
            {!camera.isActive && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card"
              >
                <div className="rounded-full bg-muted p-5">
                  <CameraOff className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">Tap Start Camera below</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live status badge */}
          {camera.isActive && (
            <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-md border",
                  isSigning && "bg-primary/90 text-primary-foreground border-primary animate-pulse",
                  isProcessing && "bg-amber-500/90 text-white border-amber-400",
                  isListening && "bg-black/60 text-emerald-300 border-emerald-500/40",
                  !isSigning && !isProcessing && !isListening && "bg-black/60 text-white border-white/20"
                )}
              >
                {isSigning ? (
                  <>
                    <Hand className="h-3.5 w-3.5" /> Signing…
                  </>
                ) : isProcessing ? (
                  <>
                    <Sparkles className="h-3.5 w-3.5 animate-spin" /> Translating…
                  </>
                ) : isListening ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    Listening — sign when ready
                  </>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" /> Loading…
                  </>
                )}
              </div>

              {mediapipe.fps > 0 && (
                <div className="bg-black/60 rounded-lg px-2 py-1">
                  <span className="text-xs font-mono text-white">{mediapipe.fps} fps</span>
                </div>
              )}
            </div>
          )}

          {/* Signing border glow */}
          <AnimatePresence>
            {isSigning && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 pointer-events-none border-2 border-primary rounded-2xl"
              />
            )}
          </AnimatePresence>
        </motion.div>

        {/* Camera toggle */}
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleCameraToggle}
            className={cn(
              "flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-semibold transition-colors",
              camera.isActive
                ? "bg-muted hover:bg-accent text-foreground"
                : "gradient-brand text-white glow-primary"
            )}
          >
            {camera.isActive ? (
              <>
                <CameraOff className="h-4 w-4" /> Stop Camera
              </>
            ) : (
              <>
                <Camera className="h-4 w-4" /> Start Camera
              </>
            )}
          </motion.button>
        </div>

        <AnimatePresence>
          {camera.error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {camera.error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live word hints while signing */}
        <LivePreviewBar
          preview={translation.livePreview}
          visible={settings.showLivePreview && isSigning}
        />

        {/* Output directly below camera */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <SentenceOutput
            result={translation.currentResult}
            isProcessing={isProcessing}
            isSigning={isSigning}
            showRawWords={settings.showRawWords}
            onClear={translation.clearResults}
            recentResults={translation.recentResults}
          />
        </motion.div>

        {/* Tips */}
        <div className="glass rounded-xl p-4 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground text-sm">How it works</p>
          <ul className="space-y-1 list-disc list-inside">
            <li>Sign one sentence, then hold still for ~1 second</li>
            <li>Pause briefly between individual signs in a sentence</li>
            <li>Keep hands visible and well-lit for best accuracy</li>
            <li>
              Use <strong>Practice</strong> mode to train personal templates — big accuracy boost
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
