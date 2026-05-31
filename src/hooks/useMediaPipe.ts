// src/hooks/useMediaPipe.ts
// Loads MediaPipe Holistic and runs landmark detection on each video frame.
// Frame data is stored in refs (not React state) to avoid re-render loops at 30fps.

"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import type { LandmarkFrame, Point3D } from "@/types";
import { resolveMediaPipeFile } from "@/services/storage/modelCache";

export type MediaPipeStatus = "not_loaded" | "loading" | "ready" | "error";

export type FrameListener = (frame: LandmarkFrame) => void;

interface UseMediaPipeReturn {
  status: MediaPipeStatus;
  fps: number;
  startDetection: (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => void;
  stopDetection: () => void;
  setFrameListener: (listener: FrameListener | null) => void;
  getLastFrame: () => LandmarkFrame | null;
}

function toPoint3D(lm: { x: number; y: number; z: number; visibility?: number }): Point3D {
  return { x: lm.x, y: lm.y, z: lm.z, visibility: lm.visibility };
}

export function useMediaPipe(): UseMediaPipeReturn {
  const [status, setStatus] = useState<MediaPipeStatus>("not_loaded");
  const [fps, setFps] = useState(0);

  const holisticRef = useRef<unknown>(null);
  const cameraRef = useRef<unknown>(null);
  const fpsCounterRef = useRef({ frames: 0, lastTime: 0 });
  const startedRef = useRef(false);
  const lastFrameRef = useRef<LandmarkFrame | null>(null);
  const frameListenerRef = useRef<FrameListener | null>(null);

  const setFrameListener = useCallback((listener: FrameListener | null) => {
    frameListenerRef.current = listener;
  }, []);

  const getLastFrame = useCallback(() => lastFrameRef.current, []);

  const stopDetection = useCallback(() => {
    startedRef.current = false;
    const cam = cameraRef.current as { stop?: () => void } | null;
    if (cam?.stop) cam.stop();
    cameraRef.current = null;
    holisticRef.current = null;
    lastFrameRef.current = null;
    setStatus("not_loaded");
    setFps(0);
  }, []);

  const startDetection = useCallback(
    async (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => {
      if (startedRef.current) return;
      startedRef.current = true;
      setStatus("loading");

      try {
        const mpHolistic = await import("@mediapipe/holistic");
        const mpDrawing = await import("@mediapipe/drawing_utils");
        const mpCamera = await import("@mediapipe/camera_utils");

        const holistic = new mpHolistic.Holistic({
          locateFile: resolveMediaPipeFile,
        });

        holistic.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          refineFaceLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        const ctx = canvasElement.getContext("2d");

        holistic.onResults((results: {
          image: CanvasImageSource;
          poseLandmarks?: { x: number; y: number; z: number }[];
          leftHandLandmarks?: { x: number; y: number; z: number }[];
          rightHandLandmarks?: { x: number; y: number; z: number }[];
          faceLandmarks?: { x: number; y: number; z: number }[];
        }) => {
          if (!ctx) return;

          ctx.save();
          ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
          ctx.translate(canvasElement.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);
          ctx.restore();

          if (results.poseLandmarks) {
            mpDrawing.drawConnectors(ctx, results.poseLandmarks as never, mpHolistic.POSE_CONNECTIONS, {
              color: "#2DD4BF",
              lineWidth: 2,
            });
            mpDrawing.drawLandmarks(ctx, results.poseLandmarks as never, {
              color: "#F472B6",
              lineWidth: 1,
              radius: 3,
            });
          }

          if (results.leftHandLandmarks) {
            mpDrawing.drawConnectors(ctx, results.leftHandLandmarks as never, mpHolistic.HAND_CONNECTIONS, {
              color: "#2DD4BF",
              lineWidth: 2,
            });
            mpDrawing.drawLandmarks(ctx, results.leftHandLandmarks as never, {
              color: "#2DD4BF",
              lineWidth: 1,
              radius: 4,
            });
          }

          if (results.rightHandLandmarks) {
            mpDrawing.drawConnectors(ctx, results.rightHandLandmarks as never, mpHolistic.HAND_CONNECTIONS, {
              color: "#A78BFA",
              lineWidth: 2,
            });
            mpDrawing.drawLandmarks(ctx, results.rightHandLandmarks as never, {
              color: "#A78BFA",
              lineWidth: 1,
              radius: 4,
            });
          }

          if (results.faceLandmarks) {
            mpDrawing.drawConnectors(ctx, results.faceLandmarks as never, mpHolistic.FACEMESH_TESSELATION, {
              color: "#C0C0C070",
              lineWidth: 0.5,
            });
            mpDrawing.drawConnectors(ctx, results.faceLandmarks as never, mpHolistic.FACEMESH_RIGHT_EYE, {
              color: "#F472B6",
              lineWidth: 1,
            });
            mpDrawing.drawConnectors(ctx, results.faceLandmarks as never, mpHolistic.FACEMESH_LEFT_EYE, {
              color: "#2DD4BF",
              lineWidth: 1,
            });
            mpDrawing.drawConnectors(ctx, results.faceLandmarks as never, mpHolistic.FACEMESH_FACE_OVAL, {
              color: "#E0E0E0",
              lineWidth: 1,
            });
          }

          const frame: LandmarkFrame = {
            poseLandmarks: results.poseLandmarks?.map(toPoint3D) ?? [],
            leftHandLandmarks: results.leftHandLandmarks?.map(toPoint3D) ?? [],
            rightHandLandmarks: results.rightHandLandmarks?.map(toPoint3D) ?? [],
            faceLandmarks: results.faceLandmarks?.map(toPoint3D) ?? [],
            timestamp: Date.now(),
          };

          // Ref only — never setState per frame (prevents infinite re-render loop)
          lastFrameRef.current = frame;
          frameListenerRef.current?.(frame);

          const counter = fpsCounterRef.current;
          counter.frames++;
          const now = Date.now();
          if (now - counter.lastTime >= 1000) {
            setFps(counter.frames);
            counter.frames = 0;
            counter.lastTime = now;
          }
        });

        holisticRef.current = holistic;

        const camera = new mpCamera.Camera(videoElement, {
          onFrame: async () => {
            if (holisticRef.current) {
              await (
                holisticRef.current as { send: (opts: { image: HTMLVideoElement }) => Promise<void> }
              ).send({ image: videoElement });
            }
          },
          width: videoElement.videoWidth || 640,
          height: videoElement.videoHeight || 480,
        });

        cameraRef.current = camera;
        fpsCounterRef.current.lastTime = performance.now();
        await camera.start();
        setStatus("ready");
      } catch (err) {
        console.error("[useMediaPipe] Failed to load:", err);
        startedRef.current = false;
        setStatus("error");
      }
    },
    []
  );

  useEffect(() => () => stopDetection(), [stopDetection]);

  return { status, fps, startDetection, stopDetection, setFrameListener, getLastFrame };
}
