"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Download, Wifi, CheckCircle2, AlertTriangle } from "lucide-react";
import type { OfflineModelState } from "@/hooks/useOfflineModels";
import type { DownloadProgress } from "@/services/storage/modelCache";
import { cn } from "@/lib/cn";

interface ModelDownloaderProps {
  state: OfflineModelState;
  progress: DownloadProgress | null;
  error: string | null;
  onRetry: () => void;
}

export function ModelDownloader({ state, progress, error, onRetry }: ModelDownloaderProps) {
  const show = state === "checking" || state === "downloading" || state === "error";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            className="glass rounded-2xl p-8 max-w-md w-full space-y-6 text-center shadow-2xl"
          >
            {state === "error" ? (
              <>
                <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
                <div>
                  <h2 className="text-xl font-bold mb-2">Download failed</h2>
                  <p className="text-sm text-muted-foreground">{error ?? "Could not cache offline models."}</p>
                </div>
                <button
                  type="button"
                  onClick={onRetry}
                  className="w-full rounded-xl gradient-brand py-3 text-sm font-semibold text-white"
                >
                  Retry download
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto h-14 w-14 rounded-2xl gradient-brand flex items-center justify-center glow-primary">
                  {state === "checking" ? (
                    <Wifi className="h-7 w-7 text-white animate-pulse" />
                  ) : (
                    <Download className="h-7 w-7 text-white animate-bounce" />
                  )}
                </div>

                <div>
                  <h2 className="text-xl font-bold mb-1">
                    {state === "checking" ? "Checking offline cache…" : "Preparing offline mode"}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Downloading AI models once — works without internet after this.
                  </p>
                </div>

                {progress && state === "downloading" && (
                  <div className="space-y-3 text-left">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Overall</span>
                      <span className="font-mono text-primary">{progress.overall}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full gradient-brand"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress.overall}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-muted-foreground">MediaPipe</span>
                        <p className="font-mono font-semibold text-primary">{progress.mediapipe}%</p>
                      </div>
                      <div className="rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-muted-foreground">LSTM config</span>
                        <p className="font-mono font-semibold text-primary">{progress.lstm}%</p>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground truncate">
                      {progress.currentFile}
                    </p>
                  </div>
                )}

                {state === "checking" && (
                  <div className="flex justify-center gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small badge shown in navbar when models are ready */
export function ModelReadyBadge({ ready, online }: { ready: boolean; online: boolean }) {
  return (
    <div
      className={cn(
        "hidden sm:flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border",
        ready && online && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
        ready && !online && "border-amber-500/40 bg-amber-500/10 text-amber-400",
        !ready && "border-muted text-muted-foreground"
      )}
      title={ready ? (online ? "Models cached — online" : "Models cached — offline") : "Loading models"}
    >
      {ready ? (
        <>
          <CheckCircle2 className="h-3 w-3" />
          {online ? "Offline ready" : "Offline mode"}
        </>
      ) : (
        <>
          <Download className="h-3 w-3 animate-pulse" />
          Loading…
        </>
      )}
    </div>
  );
}
