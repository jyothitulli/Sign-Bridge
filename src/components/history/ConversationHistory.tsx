"use client";

import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, MessageSquarePlus, MessagesSquare } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { MessageBubble } from "./MessageBubble";
import { cn } from "@/lib/cn";

export function ConversationHistory() {
  const {
    sessions,
    activeSession,
    startNewSession,
    deleteSession,
    clearAllSessions,
  } = useAppStore();

  const allMessages = useMemo(() => {
    const flat = sessions.flatMap((s) =>
      s.messages.map((m) => ({ ...m, sessionId: s.id }))
    );
    return flat.sort((a, b) => a.timestamp - b.timestamp);
  }, [sessions]);

  const hasHistory = allMessages.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => startNewSession()}
          className="flex items-center gap-2 rounded-xl gradient-brand px-4 py-2.5 text-sm font-semibold text-white glow-primary"
        >
          <MessageSquarePlus className="h-4 w-4" />
          New conversation
        </motion.button>
        {hasHistory && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              if (confirm("Delete all conversation history?")) clearAllSessions();
            }}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Clear all
          </motion.button>
        )}
      </div>

      {activeSession && (
        <p className="text-xs text-muted-foreground">
          Active session · {activeSession.messages.length} message
          {activeSession.messages.length !== 1 ? "s" : ""}
        </p>
      )}

      <AnimatePresence mode="wait">
        {!hasHistory ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass rounded-2xl p-10 text-center"
          >
            <MessagesSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No translations yet. Record on the Translate page or use Reverse Mode —
              messages appear here automatically.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {sessions.map((session) => (
              <section key={session.id} className="space-y-3">
                <div className="flex items-center justify-between gap-2 sticky top-16 z-10 py-2 bg-background/80 backdrop-blur-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                    {new Date(session.createdAt).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm("Delete this session?")) deleteSession(session.id);
                    }}
                    className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>

                <div className="space-y-4 pl-1">
                  {session.messages.map((msg, i) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      align={msg.type === "signed" ? "right" : "left"}
                    />
                  ))}
                </div>
              </section>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {hasHistory && (
        <p className={cn("text-center text-[10px] text-muted-foreground pt-2")}>
          {allMessages.length} total · stored locally in your browser
        </p>
      )}
    </div>
  );
}
