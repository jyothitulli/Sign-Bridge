"use client";

import { useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Hand } from "lucide-react";
import {
  NEUTRAL_POSE,
  getSignAnimation,
  interpolatePose,
  type SkeletonPose,
} from "@/features/reverse/signDictionary";
import { cn } from "@/lib/cn";

const BONES: [keyof SkeletonPose, keyof SkeletonPose][] = [
  ["head", "neck"],
  ["neck", "leftShoulder"],
  ["neck", "rightShoulder"],
  ["leftShoulder", "leftElbow"],
  ["leftElbow", "leftWrist"],
  ["rightShoulder", "rightElbow"],
  ["rightElbow", "rightWrist"],
  ["neck", "hip"],
  ["hip", "leftKnee"],
  ["leftKnee", "leftAnkle"],
  ["hip", "rightKnee"],
  ["rightKnee", "rightAnkle"],
];

interface Skeleton2DAvatarProps {
  currentWord: string | null;
  frameProgress: number;
  isPlaying: boolean;
  className?: string;
}

export function Skeleton2DAvatar({
  currentWord,
  frameProgress,
  isPlaying,
  className,
}: Skeleton2DAvatarProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const resolvePose = useCallback((): SkeletonPose => {
    if (!currentWord) return NEUTRAL_POSE;
    const anim = getSignAnimation(currentWord);
    if (!anim || anim.keyframes.length < 2) return NEUTRAL_POSE;

    const segments = anim.keyframes.length - 1;
    const scaled = frameProgress * segments;
    const idx = Math.min(Math.floor(scaled), segments - 1);
    const t = scaled - idx;
    return interpolatePose(anim.keyframes[idx], anim.keyframes[idx + 1], t);
  }, [currentWord, frameProgress]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pose = resolvePose();
    const px = (p: { x: number; y: number }) => ({ x: p.x * w, y: p.y * h });

    // Subtle grid
    ctx.strokeStyle = "hsla(221, 83%, 53%, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((w / 4) * i, 0);
      ctx.lineTo((w / 4) * i, h);
      ctx.stroke();
    }

    // Glow behind figure when playing
    if (isPlaying) {
      const hip = px(pose.hip);
      const grad = ctx.createRadialGradient(hip.x, hip.y, 10, hip.x, hip.y, w * 0.35);
      grad.addColorStop(0, "hsla(221, 83%, 63%, 0.25)");
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Bones
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const [a, b] of BONES) {
      const p1 = px(pose[a]);
      const p2 = px(pose[b]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = isPlaying ? "hsl(221, 83%, 63%)" : "hsl(215, 20%, 55%)";
      ctx.lineWidth = isPlaying ? 4 : 3;
      ctx.stroke();
    }

    // Joints
    const joints = Object.values(pose);
    for (const j of joints) {
      const p = px(j);
      ctx.beginPath();
      ctx.arc(p.x, p.y, isPlaying ? 6 : 5, 0, Math.PI * 2);
      ctx.fillStyle = isPlaying ? "hsl(168, 84%, 45%)" : "hsl(221, 83%, 53%)";
      ctx.fill();
    }

    // Head highlight
    const head = px(pose.head);
    ctx.beginPath();
    ctx.arc(head.x, head.y, 14, 0, Math.PI * 2);
    ctx.strokeStyle = "hsla(168, 84%, 45%, 0.5)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [resolvePose, isPlaying]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * (window.devicePixelRatio || 1);
      canvas.height = rect.height * (window.devicePixelRatio || 1);
      draw();
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [draw]);

  const hasAnim = currentWord ? !!getSignAnimation(currentWord) : true;

  return (
    <motion.div
      className={cn(
        "glass rounded-2xl overflow-hidden border border-border aspect-[4/5] relative",
        isPlaying && "ring-2 ring-primary/40",
        className
      )}
      animate={isPlaying ? { boxShadow: ["0 0 0 0 hsl(221 83% 53% / 0)", "0 0 24px 4px hsl(221 83% 53% / 0.2)", "0 0 0 0 hsl(221 83% 53% / 0)"] } : {}}
      transition={{ duration: 1.2, repeat: isPlaying ? Infinity : 0 }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Header */}
      <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between z-10 bg-gradient-to-b from-background/80 to-transparent">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg gradient-brand flex items-center justify-center">
            <Hand className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
              2D Avatar
            </p>
            <p className="text-sm font-semibold">
              {currentWord ?? "Ready"}
            </p>
          </div>
        </div>
        {isPlaying && (
          <span className="text-xs font-mono px-2 py-1 rounded-full bg-primary/20 text-primary animate-pulse">
            Signing
          </span>
        )}
      </div>

      {!hasAnim && currentWord && (
        <div className="absolute bottom-4 inset-x-4 z-10 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-2 text-xs text-amber-400 text-center">
          No animation for &quot;{currentWord}&quot; — showing neutral pose
        </div>
      )}

      {!currentWord && !isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <p className="text-sm text-muted-foreground text-center px-6">
            Convert a sentence, then press Play to watch signs
          </p>
        </div>
      )}
    </motion.div>
  );
}
