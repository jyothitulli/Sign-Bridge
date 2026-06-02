// src/components/translation/SentenceOutput.tsx
// Displays the translated sentence with animation, raw words, and confidence.

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Volume2, RotateCcw, Sparkles } from "lucide-react";
import { useState, useCallback } from "react";
import type { TranslationResult } from "@/types";
import { cn } from "@/lib/cn";

interface SentenceOutputProps {
  result: TranslationResult | null;
  isProcessing?: boolean;
  isSigning?: boolean;
  showRawWords?: boolean;
  onClear?: () => void;
  recentResults?: TranslationResult[];
}

export function SentenceOutput({
  result,
  isProcessing = false,
  isSigning = false,
  showRawWords = true,
  onClear,
  recentResults = [],
}: SentenceOutputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!result?.correctedSentence) return;
    await navigator.clipboard.writeText(result.correctedSentence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleSpeak = useCallback(() => {
    if (!result?.correctedSentence || !("speechSynthesis" in window)) return;
    const utterance = new SpeechSynthesisUtterance(result.correctedSentence);
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }, [result]);

  const confidencePct = result ? Math.round(result.confidence * 100) : 0;
  const confidenceColor =
    confidencePct >= 80 ? "text-emerald-400" :
    confidencePct >= 60 ? "text-amber-400" :
    "text-rose-400";

  return (
    <div className="w-full space-y-3">

      {/* ── Processing state ── */}
      <AnimatePresence mode="wait">
        {isProcessing && (
          <motion.div
            key="processing"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass rounded-2xl p-6 flex items-center justify-center gap-3"
          >
            <div className="flex gap-1.5">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-primary"
                  animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">Processing your signs...</span>
          </motion.div>
        )}

        {/* ── Result state ── */}
        {!isProcessing && result && (
          <motion.div
            key={result.id}
            initial={{ opacity: 0, scale: 0.97, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="glass rounded-2xl p-5 space-y-4"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-widest">
                  Translation
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {/* Confidence badge */}
                <span className={cn("text-xs font-mono font-semibold", confidenceColor)}>
                  {confidencePct}%
                </span>
                {/* Question type badge */}
                <span className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  result.questionType === "WH"       && "bg-blue-500/15 text-blue-400",
                  result.questionType === "YES_NO"   && "bg-purple-500/15 text-purple-400",
                  result.questionType === "STATEMENT" && "bg-emerald-500/15 text-emerald-400",
                )}>
                  {result.questionType === "WH"        ? "WH-Q" :
                   result.questionType === "YES_NO"    ? "Yes/No" :
                   "Statement"}
                </span>
                {result.engine && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                    {result.engine === "tcn"
                      ? "TCN"
                      : result.engine === "lstm"
                        ? "LSTM"
                        : result.engine === "dtw"
                          ? "DTW"
                          : "Classifier"}
                  </span>
                )}
              </div>
            </div>

            {/* Main translated sentence */}
            <motion.p
              className="text-2xl font-semibold leading-snug text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              {result.correctedSentence}
            </motion.p>

            {/* Raw words (debug / educational) */}
            {showRawWords && result.rawWords.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="flex flex-wrap gap-1.5"
              >
                <span className="text-xs text-muted-foreground mr-1">Signs detected:</span>
                {result.rawWords.map((word, i) => (
                  <span
                    key={i}
                    className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground"
                  >
                    {word}
                  </span>
                ))}
              </motion.div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>

              {"speechSynthesis" in (typeof window !== "undefined" ? window : {}) && (
                <button
                  onClick={handleSpeak}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  Speak
                </button>
              )}

              {onClear && (
                <button
                  onClick={onClear}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-muted hover:bg-accent text-muted-foreground hover:text-foreground transition-colors ml-auto"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Clear
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Empty state ── */}
        {!isProcessing && !result && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-2xl p-8 text-center"
          >
            {isSigning ? (
              <p className="text-muted-foreground text-sm">
                <span className="text-primary font-medium">Signing detected</span> — finish your
                sentence and pause to translate.
              </p>
            ) : (
              <p className="text-muted-foreground text-sm">
                Your translation will appear here automatically when you finish signing and pause.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Previous translations */}
      {recentResults.length > 1 && (
        <div className="glass rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Recent
          </p>
          {recentResults.slice(1, 4).map((r) => (
            <p key={r.id} className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
              {r.correctedSentence}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}