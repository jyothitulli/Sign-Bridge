"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { englishToGloss } from "@/features/reverse/ReverseGrammarEngine";
import { getSignAnimation } from "@/features/reverse/signDictionary";
import type { SignPoseSequence } from "@/features/reverse/signDictionary";
import { useAppStore } from "@/stores/appStore";

export type PlaybackState = "idle" | "playing" | "done";

export interface PlaybackItem {
  word: string;
  sequence: SignPoseSequence | null;
  durationMs: number;
}

const GAP_MS = 200;

interface UseSentenceToSignReturn {
  inputSentence: string;
  setInputSentence: (s: string) => void;
  signGloss: string[];
  playbackState: PlaybackState;
  currentWord: string | null;
  currentWordIndex: number;
  /** 0–1 progress within the current sign animation */
  currentFrame: number;
  playbackItems: PlaybackItem[];
  submitSentence: (sentence?: string) => void;
  playSequence: () => void;
  stopPlayback: () => void;
}

export function useSentenceToSign(): UseSentenceToSignReturn {
  const [inputSentence, setInputSentence] = useState("");
  const [signGloss, setSignGloss] = useState<string[]>([]);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [currentWord, setCurrentWord] = useState<string | null>(null);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playbackItems, setPlaybackItems] = useState<PlaybackItem[]>([]);

  const rafRef = useRef<number | null>(null);
  const playingRef = useRef(false);

  const { settings, addMessage, activeSession, startNewSession } = useAppStore();

  const stopPlaybackInternal = useCallback(() => {
    playingRef.current = false;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const submitSentence = useCallback(
    (sentence?: string) => {
      const text = (sentence ?? inputSentence).trim();
      if (!text) return;

      stopPlaybackInternal();
      const gloss = englishToGloss(text);
      setSignGloss(gloss);
      setInputSentence(text);

      const items: PlaybackItem[] = gloss.map((word) => {
        const sequence = getSignAnimation(word);
        const baseDuration = sequence
          ? sequence.frameDuration * Math.max(1, sequence.keyframes.length - 1)
          : 600;
        return {
          word,
          sequence,
          durationMs: Math.round(baseDuration / settings.avatarSpeed),
        };
      });
      setPlaybackItems(items);

      if (!activeSession) startNewSession();
      addMessage({
        id: crypto.randomUUID(),
        type: "typed",
        rawWords: gloss,
        sentence: text,
        timestamp: Date.now(),
      });
    },
    [
      inputSentence,
      settings.avatarSpeed,
      addMessage,
      activeSession,
      startNewSession,
      stopPlaybackInternal,
    ]
  );

  const stopPlayback = useCallback(() => {
    stopPlaybackInternal();
    setPlaybackState("idle");
    setCurrentWord(null);
    setCurrentWordIndex(-1);
    setCurrentFrame(0);
  }, []);

  const playSequence = useCallback(() => {
    if (playbackItems.length === 0 || playingRef.current) return;

    playingRef.current = true;
    setPlaybackState("playing");

    let wordIdx = 0;

    const playWord = (startTime: number) => {
      if (!playingRef.current || wordIdx >= playbackItems.length) {
        playingRef.current = false;
        setPlaybackState("done");
        setCurrentWord(null);
        setCurrentWordIndex(-1);
        setCurrentFrame(0);
        return;
      }

      const item = playbackItems[wordIdx];
      setCurrentWord(item.word);
      setCurrentWordIndex(wordIdx);

      const duration = item.durationMs;
      const gap = Math.round(GAP_MS / settings.avatarSpeed);

      const tick = (now: number) => {
        if (!playingRef.current) return;
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        setCurrentFrame(t);

        if (elapsed < duration) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          wordIdx += 1;
          setTimeout(() => {
            if (playingRef.current) playWord(performance.now());
          }, gap);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    playWord(performance.now());
  }, [playbackItems, settings.avatarSpeed]);

  useEffect(() => () => stopPlaybackInternal(), [stopPlaybackInternal]);

  return {
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
  };
}
