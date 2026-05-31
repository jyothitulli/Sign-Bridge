"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Eye } from "lucide-react";
import type { LivePreview } from "@/hooks/useSignTranslation";
import { cn } from "@/lib/cn";

interface LivePreviewBarProps {
  preview: LivePreview;
  visible: boolean;
}

export function LivePreviewBar({ preview, visible }: LivePreviewBarProps) {
  const hasContent = preview.confirmed.length > 0 || preview.current;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
        >
          <div className="glass rounded-xl px-4 py-3 border border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
                Live preview
              </span>
            </div>

            {!hasContent ? (
              <p className="text-xs text-muted-foreground animate-pulse">
                Detecting signs as you move…
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-1.5">
                {preview.confirmed.map((word, i) => (
                  <span
                    key={`${word}-${i}`}
                    className="text-xs font-mono px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  >
                    {word}
                  </span>
                ))}
                {preview.current && (
                  <span
                    className={cn(
                      "text-xs font-mono px-2.5 py-1 rounded-lg border border-dashed animate-pulse",
                      "border-primary/50 bg-primary/10 text-primary"
                    )}
                  >
                    {preview.current}
                    {preview.currentConfidence > 0
                      ? ` (${Math.round(preview.currentConfidence * 100)}%)`
                      : ""}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
