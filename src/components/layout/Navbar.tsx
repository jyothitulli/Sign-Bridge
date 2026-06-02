// src/components/layout/Navbar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Camera,
  RotateCcw,
  History,
  Settings,
  Hand,
  Menu,
  X,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useState } from "react";
import { ModelReadyBadge } from "@/components/offline/ModelDownloader";
import { usePWA } from "@/hooks/usePWA";
import { useAppStore } from "@/stores/appStore";

const NAV_ITEMS = [
  { href: "/translate", label: "Translate", icon: Camera },
  { href: "/emergency",  label: "Emergency", icon: AlertTriangle },
  { href: "/reverse",   label: "Reverse",   icon: RotateCcw },
  { href: "/history",   label: "History",   icon: History },
  { href: "/settings",  label: "Settings",  icon: Settings },
] as const;

export function Navbar() {
  const pathname  = usePathname();
  const [open, setOpen] = useState(false);
  const { isOnline } = usePWA();
  const modelsReady = useAppStore((s) => s.mediapipeStatus === "ready");

  return (
    <header className="sticky top-0 z-50 w-full glass border-b border-border/40">
      <nav className="container mx-auto flex h-16 items-center justify-between px-4">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <motion.div
            whileHover={{ rotate: 15 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="flex h-9 w-9 items-center justify-center rounded-xl gradient-brand glow-primary"
          >
            <Hand className="h-5 w-5 text-white" />
          </motion.div>
          <span className="font-bold text-lg tracking-tight">
            Sign<span className="text-primary">Bridge</span>
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-3">
          <ModelReadyBadge ready={modelsReady} online={isOnline} />
          <ul className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href === "/translate" && pathname === "/");
            return (
              <li key={href}>
                <Link href={href}>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={cn(
                      "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {active && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 rounded-lg bg-primary/10"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <Icon className="h-4 w-4" />
                    {label}
                  </motion.div>
                </Link>
              </li>
            );
          })}
        </ul>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-lg"
        >
          <ul className="container mx-auto flex flex-col gap-1 px-4 py-3">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href === "/translate" && pathname === "/");
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </motion.div>
      )}
    </header>
  );
}