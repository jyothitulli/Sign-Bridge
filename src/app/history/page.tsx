"use client";

import { motion } from "framer-motion";
import { History } from "lucide-react";
import { ConversationHistory } from "@/components/history/ConversationHistory";

export default function HistoryPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          Conversation History
        </h1>
        <p className="text-sm text-muted-foreground">
          Your sign translations and reverse-mode sentences, saved locally in your browser.
        </p>
      </motion.div>

      <ConversationHistory />
    </div>
  );
}
