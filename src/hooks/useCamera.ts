// src/hooks/useCamera.ts
// Manages webcam stream: permissions, resolution, start/stop.

"use client";

import { useRef, useState, useCallback } from "react";
import type { AppSettings } from "@/types";

export type CameraStatus = "idle" | "requesting" | "active" | "error";

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  error: string | null;
  startCamera: (resolution: AppSettings["cameraResolution"]) => Promise<void>;
  stopCamera: () => void;
  isActive: boolean;
}

const RESOLUTION_MAP: Record<AppSettings["cameraResolution"], { width: number; height: number }> = {
  "480x360":  { width: 480,  height: 360  },
  "640x480":  { width: 640,  height: 480  },
  "1280x720": { width: 1280, height: 720  },
};

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async (resolution: AppSettings["cameraResolution"] = "640x480") => {
    setStatus("requesting");
    setError(null);

    try {
      // Stop existing stream if any
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }

      const { width, height } = RESOLUTION_MAP[resolution];

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:       { ideal: width  },
          height:      { ideal: height },
          facingMode:  "user",           // front camera on mobile
          frameRate:   { ideal: 30 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("active");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Camera access denied";
      setError(msg);
      setStatus("error");
      console.error("[useCamera] Error:", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  return {
    videoRef,
    status,
    error,
    startCamera,
    stopCamera,
    isActive: status === "active",
  };
}