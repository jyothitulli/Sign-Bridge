"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import { useSentenceToSign } from "@/hooks/useSentenceToSign";
import { Skeleton2DAvatar } from "@/components/reverse/Skeleton2DAvatar";
import { SignSequencePlayer } from "@/components/reverse/SignSequencePlayer";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/cn";

const QUICK_SENTENCES = [
  "What is your name?",
  "Are you hungry?",
  "I am very tired.",
  "The weather is hot today.",
  "Where are you from?",
];

export default function ReversePage() {
  const {
    inputSentence,
    setInputSentence,
    signGloss,
    playbackState,
    currentWord,
    currentWordIndex,
    currentFrame,
    playbackItems,
    submitSentence,
    playSequence,
    stopPlayback,
  } = useSentenceToSign();

  const { settings, updateSettings } = useAppStore();
  const isPlaying = playbackState === "playing";

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      e?.preventDefault();
      submitSentence();
    },
    [submitSentence]
  );

  const handleQuick = useCallback(
    (sentence: string) => {
      setInputSentence(sentence);
      submitSentence(sentence);
    },
    [setInputSentence, submitSentence]
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <RotateCcw className="h-6 w-6 text-primary" />
          Reverse Mode
        </h1>
        <p className="text-sm text-muted-foreground">
          Type English — watch the 2D avatar sign in ASL gloss order (offline, CPU-only).
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: input + controls */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-4"
        >
          <form onSubmit={handleSubmit} className="glass rounded-2xl p-5 space-y-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              English sentence
            </label>
            <textarea
              value={inputSentence}
              onChange={(e) => setInputSentence(e.target.value)}
              placeholder='e.g. "What is your name?"'
              rows={3}
              className="w-full rounded-xl border border-border bg-background/50 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-2 rounded-xl gradient-brand glow-primary py-3 text-sm font-semibold text-white"
            >
              <Send className="h-4 w-4" />
              Convert to Sign Gloss
            </motion.button>
          </form>

          {signGloss.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-primary uppercase tracking-widest">
                  ASL gloss order
                </span>
              </div>
              <p className="font-mono text-lg tracking-wide text-foreground">
                {signGloss.join(" + ")}
              </p>
              <p className="text-xs text-muted-foreground">
                Articles and auxiliaries removed; WH-words moved to the end (ASL grammar).
              </p>
            </motion.div>
          )}

          <div className="glass rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                Avatar speed
              </span>
              <span className="text-sm font-mono text-primary">{settings.avatarSpeed}x</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1.5}
              step={0.25}
              value={settings.avatarSpeed}
              onChange={(e) =>
                updateSettings({ avatarSpeed: parseFloat(e.target.value) })
              }
              className="w-full accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>0.5x slow</span>
              <span>1x</span>
              <span>1.5x fast</span>
            </div>

            <SignSequencePlayer
              items={playbackItems}
              playbackState={playbackState}
              currentWordIndex={currentWordIndex}
              onPlay={playSequence}
              onStop={stopPlayback}
              disabled={signGloss.length === 0}
            />
          </div>

          <div className="glass rounded-2xl p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-3">
              Quick examples
            </p>
            <div className="flex flex-wrap gap-2">
              {QUICK_SENTENCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleQuick(s)}
                  className={cn(
                    "text-xs rounded-lg px-3 py-1.5 border border-border",
                    "hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right: 2D avatar */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Skeleton2DAvatar
            currentWord={isPlaying ? currentWord : null}
            frameProgress={currentFrame}
            isPlaying={isPlaying}
          />
          {playbackState === "done" && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-sm text-emerald-400 mt-3"
            >
              Sequence complete
            </motion.p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
