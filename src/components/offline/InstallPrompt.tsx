"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Smartphone, X } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { useState } from "react";

export function InstallPrompt() {
  const { canInstall, install, isInstalled } = usePWA();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = "signbridge-install-dismissed";
    if (sessionStorage.getItem(key)) setDismissed(true);
  }, []);

  if (!canInstall || dismissed || isInstalled) return null;

  const dismiss = () => {
    sessionStorage.setItem("signbridge-install-dismissed", "1");
    setDismissed(true);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md"
      >
        <div className="glass rounded-2xl p-4 flex items-start gap-3 border border-primary/30 shadow-xl">
          <div className="h-10 w-10 rounded-xl gradient-brand flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Install SignBridge</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Add to your home screen for app-like signing — works offline.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => install()}
                className="rounded-lg gradient-brand px-4 py-1.5 text-xs font-semibold text-white"
              >
                Install app
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Not now
              </button>
            </div>
          </div>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
