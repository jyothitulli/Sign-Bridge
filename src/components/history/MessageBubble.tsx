"use client";

import { motion } from "framer-motion";
import { Camera, Type, Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";
import type { ConversationMessage } from "@/types";
import { cn } from "@/lib/cn";

interface MessageBubbleProps {
  message: ConversationMessage;
  align?: "left" | "right";
}

export function MessageBubble({ message, align = "left" }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const isSigned = message.type === "signed";

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.sentence);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [message.sentence]);

  const time = new Date(message.timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex flex-col gap-1 max-w-[90%]",
        align === "right" ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-3 space-y-2 border",
          isSigned
            ? "bg-primary/10 border-primary/20 rounded-br-md"
            : "bg-muted/50 border-border rounded-bl-md"
        )}
      >
        <div className="flex items-center gap-2">
          {isSigned ? (
            <Camera className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Type className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            {isSigned ? "Sign → English" : "English → Sign"}
          </span>
        </div>

        <p className="text-sm font-medium leading-snug">{message.sentence}</p>

        {message.rawWords && message.rawWords.length > 0 && (
          <p className="text-xs font-mono text-muted-foreground">
            {message.rawWords.join(" + ")}
          </p>
        )}

        {message.confidence !== undefined && (
          <p className="text-[10px] text-emerald-400 font-mono">
            {Math.round(message.confidence * 100)}% confidence
          </p>
        )}

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> Copy
            </>
          )}
        </button>
      </div>
      <span className="text-[10px] text-muted-foreground px-1">{time}</span>
    </motion.div>
  );
}
