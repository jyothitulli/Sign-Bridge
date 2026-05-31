"use client";

import { useCallback } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Volume2, Phone, Hospital, MapPin, HelpCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const EMERGENCY_BUTTONS = [
  {
    id: "help",
    label: "Help",
    sentence: "I need help right now.",
    gloss: "HELP",
    color: "from-amber-500 to-orange-600",
    icon: HelpCircle,
  },
  {
    id: "police",
    label: "Police",
    sentence: "Please call the police. I need assistance.",
    gloss: "POLICE HELP",
    color: "from-blue-600 to-blue-800",
    icon: Phone,
  },
  {
    id: "hospital",
    label: "Hospital",
    sentence: "I need to go to the hospital. It is an emergency.",
    gloss: "HOSPITAL GO EMERGENCY",
    color: "from-red-500 to-rose-700",
    icon: Hospital,
  },
  {
    id: "lost",
    label: "Lost",
    sentence: "I am lost. Can you help me?",
    gloss: "I LOST HELP",
    color: "from-violet-500 to-purple-700",
    icon: MapPin,
  },
] as const;

export default function EmergencyPage() {
  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.85;
    u.volume = 1;
    window.speechSynthesis.speak(u);
  }, []);

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-center"
      >
        <div className="inline-flex items-center gap-2 rounded-full bg-red-500/15 border border-red-500/30 px-4 py-1.5 mb-3">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-xs font-bold text-red-400 uppercase tracking-widest">
            Emergency
          </span>
        </div>
        <h1 className="text-2xl font-bold mb-1">One-Tap Emergency</h1>
        <p className="text-sm text-muted-foreground">
          Tap a button — the app speaks clearly for a hearing person nearby.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {EMERGENCY_BUTTONS.map(({ id, label, sentence, gloss, color, icon: Icon }, i) => (
          <motion.button
            key={id}
            type="button"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => speak(sentence)}
            className={cn(
              "relative overflow-hidden rounded-2xl p-6 text-left min-h-[140px]",
              "bg-gradient-to-br text-white shadow-lg",
              "focus:outline-none focus:ring-4 focus:ring-white/20",
              color
            )}
          >
            <Icon className="h-10 w-10 mb-3 opacity-90" />
            <p className="text-xl font-bold">{label}</p>
            <p className="text-sm opacity-90 mt-1 leading-snug">{sentence}</p>
            <p className="text-[10px] font-mono opacity-70 mt-2">{gloss}</p>
            <div className="absolute top-3 right-3 flex items-center gap-1 text-xs opacity-80">
              <Volume2 className="h-3.5 w-3.5" />
              Speak
            </div>
          </motion.button>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-6">
        For life-threatening emergencies, call your local emergency number (e.g. 911).
      </p>
    </div>
  );
}
