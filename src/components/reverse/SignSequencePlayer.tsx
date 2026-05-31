"use client";

import { motion } from "framer-motion";
import { Play, Square, ListOrdered } from "lucide-react";
import type { PlaybackItem, PlaybackState } from "@/hooks/useSentenceToSign";
import { cn } from "@/lib/cn";

interface SignSequencePlayerProps {
  items: PlaybackItem[];
  playbackState: PlaybackState;
  currentWordIndex: number;
  onPlay: () => void;
  onStop: () => void;
  disabled?: boolean;
}

export function SignSequencePlayer({
  items,
  playbackState,
  currentWordIndex,
  onPlay,
  onStop,
  disabled = false,
}: SignSequencePlayerProps) {
  const isPlaying = playbackState === "playing";

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <motion.button
          type="button"
          whileHover={!disabled && !isPlaying ? { scale: 1.02 } : {}}
          whileTap={!disabled && !isPlaying ? { scale: 0.98 } : {}}
          onClick={onPlay}
          disabled={disabled || isPlaying}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-colors",
            disabled || isPlaying
              ? "bg-muted text-muted-foreground cursor-not-allowed"
              : "gradient-brand text-white glow-primary"
          )}
        >
          <Play className="h-4 w-4" />
          Play sequence
        </motion.button>
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={onStop}
          disabled={playbackState === "idle"}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium border transition-colors",
            playbackState === "idle"
              ? "border-border text-muted-foreground cursor-not-allowed opacity-50"
              : "border-border hover:border-destructive/40 hover:text-destructive"
          )}
        >
          <Square className="h-4 w-4" />
          Stop
        </motion.button>
      </div>

      {items.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <ListOrdered className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Sign queue
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((item, i) => (
              <motion.span
                key={`${item.word}-${i}`}
                layout
                className={cn(
                  "text-xs font-mono px-2.5 py-1 rounded-lg border transition-colors",
                  i === currentWordIndex && isPlaying
                    ? "border-primary bg-primary/15 text-primary scale-105"
                    : i < currentWordIndex || playbackState === "done"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-border text-muted-foreground",
                  !item.sequence && "border-amber-500/30 text-amber-400"
                )}
              >
                {item.word}
              </motion.span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
