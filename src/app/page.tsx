// src/app/page.tsx
"use client";

import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import Link from "next/link";
import {
  Camera,
  RotateCcw,
  Shield,
  Zap,
  ArrowRight,
  Hand,
  Wifi,
} from "lucide-react";

const FEATURES = [
  {
    icon: Camera,
    title: "Real-Time Translation",
    desc: "Sign → Natural English sentence, not word-by-word. Powered by LSTM + Grammar Engine.",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    icon: RotateCcw,
    title: "Reverse Mode",
    desc: "Type any English sentence and watch a 3D avatar sign it back in ASL.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Wifi,
    title: "Offline-First",
    desc: "All models run in your browser. No internet needed. No data leaves your device.",
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
  {
    icon: Shield,
    title: "Privacy First",
    desc: "Zero cloud calls. Camera data stays on your device. 100% private.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: Zap,
    title: "30 FPS Detection",
    desc: "MediaPipe Holistic tracks 543 landmarks — pose, hands, and face — in real time.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    icon: Hand,
    title: "Grammar Engine",
    desc: "Understands ASL grammar rules. Converts sign gloss to natural English fluently.",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
  },
];

// ── Framer Motion variants (typed correctly) ──────────────────────────────────

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const cardVariant: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: "easeOut" as const,
    },
  },
};

// ── Utility ───────────────────────────────────────────────────────────────────

function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(" ");
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <motion.section
        className="text-center mb-20"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary mb-8"
        >
          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Offline-first · Privacy-preserving · CPU-friendly
        </motion.div>

        {/* Headline */}
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
          Sign Language{" "}
          <span className="bg-clip-text text-transparent gradient-brand">
            Translator
          </span>
        </h1>

        {/* ✅ Fixed: quotes escaped as &ldquo; &rdquo; */}
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Not word-by-word. Real, natural sentences.{" "}
          <strong className="text-foreground">
            &ldquo;YOU NAME WHAT&rdquo; &rarr; &ldquo;What is your name?&rdquo;
          </strong>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/translate">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 rounded-xl gradient-brand glow-primary px-8 py-4 font-semibold text-white shadow-lg"
            >
              <Camera className="h-5 w-5" />
              Start Translating
              <ArrowRight className="h-4 w-4" />
            </motion.button>
          </Link>

          <Link href="/reverse">
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-8 py-4 font-semibold text-foreground hover:border-primary/40 hover:bg-accent transition-colors"
            >
              <RotateCcw className="h-5 w-5" />
              Try Reverse Mode
            </motion.button>
          </Link>
        </div>
      </motion.section>

      {/* ── Translation Example ──────────────────────────────── */}
      <motion.section
        className="mb-20"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
      >
        <div className="glass rounded-2xl p-6 md:p-10 max-w-3xl mx-auto">
          <p className="text-sm text-muted-foreground mb-6 text-center font-medium uppercase tracking-widest">
            Example — Natural Translation
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center text-center">
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground mb-2">User Signs</p>
              <p className="font-mono font-bold text-lg tracking-wide">
                YOU + NAME + WHAT
              </p>
            </div>
            <div className="flex justify-center">
              <div className="flex flex-col items-center gap-1">
                <ArrowRight className="h-6 w-6 text-primary hidden md:block" />
                <ArrowRight className="h-6 w-6 text-primary rotate-90 md:hidden" />
                <span className="text-xs text-primary font-medium">
                  Grammar Engine
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
              <p className="text-xs text-primary mb-2">Natural Output</p>
              {/* ✅ Fixed: quotes escaped */}
              <p className="font-semibold text-lg text-primary">
                &ldquo;What is your name?&rdquo;
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      {/* ── Features Grid ────────────────────────────────────── */}
      <motion.section variants={container} initial="hidden" animate="show">
        <h2 className="text-3xl font-bold text-center mb-12">
          Why SignBridge is{" "}
          <span className="text-primary">different</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <motion.div
              key={f.title}
              variants={cardVariant}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="glass rounded-2xl p-6 cursor-default"
            >
              <div className={cn("inline-flex rounded-xl p-3 mb-4", f.bg)}>
                <f.icon className={cn("h-6 w-6", f.color)} />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.section>
    </div>
  );
}