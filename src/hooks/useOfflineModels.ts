"use client";

import { useEffect, useState, useCallback } from "react";
import {
  bootstrapOfflineModels,
  recacheOfflineModels,
  markBootstrapStarted,
} from "@/services/offlineModelService";
import type { DownloadProgress } from "@/services/storage/modelCache";
import { useAppStore } from "@/stores/appStore";

export type OfflineModelState = "checking" | "downloading" | "ready" | "error";

export function useOfflineModels(options?: { autoBootstrap?: boolean }) {
  const autoBootstrap = options?.autoBootstrap ?? true;
  const [state, setState] = useState<OfflineModelState>("checking");
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const setMediapipeStatus = useAppStore((s) => s.setMediapipeStatus);
  const setLstmStatus = useAppStore((s) => s.setLstmStatus);
  const setModelProgress = useAppStore((s) => s.setModelProgress);

  const run = useCallback(
    async (forceDownload = false) => {
      setState(forceDownload ? "downloading" : "checking");
      setError(null);

      try {
        const onProgress = (p: DownloadProgress) => {
          setProgress(p);
          if (p.overall < 100) setState("downloading");
        };

        const fn = forceDownload ? recacheOfflineModels : bootstrapOfflineModels;
        await fn(setMediapipeStatus, setLstmStatus, setModelProgress, onProgress);
        setState("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Download failed");
        setState("error");
        setMediapipeStatus("error");
      }
    },
    [setMediapipeStatus, setLstmStatus, setModelProgress]
  );

  useEffect(() => {
    if (!autoBootstrap) return;
    if (!markBootstrapStarted()) return;
    run(false);
  }, [autoBootstrap, run]);

  return {
    state,
    progress,
    error,
    retry: () => run(false),
    recache: () => run(true),
  };
}

export function useRecacheModels() {
  const setMediapipeStatus = useAppStore((s) => s.setMediapipeStatus);
  const setLstmStatus = useAppStore((s) => s.setLstmStatus);
  const setModelProgress = useAppStore((s) => s.setModelProgress);

  return useCallback(async () => {
    await recacheOfflineModels(setMediapipeStatus, setLstmStatus, setModelProgress);
  }, [setMediapipeStatus, setLstmStatus, setModelProgress]);
}
