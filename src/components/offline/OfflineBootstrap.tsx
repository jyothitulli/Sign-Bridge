"use client";

import { useOfflineModels } from "@/hooks/useOfflineModels";
import { ModelDownloader } from "@/components/offline/ModelDownloader";

/** Runs once on app load — caches models for offline use. */
export function OfflineBootstrap() {
  const { state, progress, error, retry } = useOfflineModels();

  return (
    <ModelDownloader
      state={state}
      progress={progress}
      error={error}
      onRetry={retry}
    />
  );
}
