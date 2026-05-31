"use client";

import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useState } from "react";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  RotateCcw,
  Camera,
  Eye,
  Volume2,
  Clock,
  Gauge,
  Globe,
  Wifi,
  Download,
  Brain,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { DEFAULT_SETTINGS } from "@/types";
import { cn } from "@/lib/cn";
import { usePWA } from "@/hooks/usePWA";
import { useRecacheModels } from "@/hooks/useOfflineModels";
import { getLstmStatus } from "@/services/lstm/lstmInference";
import { AccountPanel } from "@/components/account/AccountPanel";

function ToggleRow({
  label,
  description,
  icon: Icon,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-4 px-3 -mx-3 rounded-xl border transition-colors",
        checked
          ? "border-primary/30 bg-primary/5"
          : "border-transparent hover:bg-muted/40"
      )}
    >
      <div className="flex items-start gap-3 min-w-0 flex-1">
        <div
          className={cn(
            "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
            checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="flex flex-col items-center gap-1 shrink-0">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={`${label}: ${checked ? "on" : "off"}`}
          data-state={checked ? "on" : "off"}
          onClick={() => onChange(!checked)}
          className="toggle-switch"
        >
          <span className="toggle-switch-knob" />
        </button>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider",
            checked ? "text-primary" : "text-muted-foreground"
          )}
        >
          {checked ? "On" : "Off"}
        </span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, mediapipeStatus, lstmStatus, modelProgress } =
    useAppStore();
  const { theme, setTheme } = useTheme();
  const { isOnline, canInstall, install, isInstalled } = usePWA();
  const recache = useRecacheModels();
  const [recaching, setRecaching] = useState(false);
  const lstmMode = getLstmStatus();

  return (
    <div className="container mx-auto px-4 py-6 max-w-lg">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Preferences are saved locally (IndexedDB via Zustand persist).
        </p>
      </motion.div>

      <div className="space-y-4">
        {/* Theme */}
        <section className="glass rounded-2xl p-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4">
            Appearance
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "light", icon: Sun, label: "Light" },
                { id: "dark", icon: Moon, label: "Dark" },
                { id: "system", icon: Monitor, label: "System" },
              ] as const
            ).map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTheme(id);
                  updateSettings({ theme: id });
                }}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl py-3 border text-sm transition-colors",
                  (theme ?? settings.theme) === id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:border-primary/30"
                )}
              >
                <Icon className="h-5 w-5" />
                {label}
              </button>
            ))}
          </div>
        </section>

        {/* Camera & overlay */}
        <section className="glass rounded-2xl px-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest pt-4 pb-2">
            Camera &amp; detection
          </p>
          <div className="mb-3">
            <label className="text-xs text-muted-foreground flex items-center gap-2 mb-2">
              <Camera className="h-3.5 w-3.5" />
              Resolution
            </label>
            <select
              value={settings.cameraResolution}
              onChange={(e) =>
                updateSettings({
                  cameraResolution: e.target.value as typeof settings.cameraResolution,
                })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="480x360">480×360 (faster, mobile)</option>
              <option value="640x480">640×480 (recommended)</option>
              <option value="1280x720">1280×720 (HD, slower on CPU)</option>
            </select>
          </div>
          <ToggleRow
            label="Skeleton overlay"
            description="Pose, hands, and body lines on camera"
            icon={Eye}
            checked={settings.showSkeletonOverlay}
            onChange={(v) => updateSettings({ showSkeletonOverlay: v })}
          />
          <ToggleRow
            label="Face mesh overlay"
            description="Face landmarks for question detection"
            icon={Eye}
            checked={settings.showFaceOverlay}
            onChange={(v) => updateSettings({ showFaceOverlay: v })}
          />
        </section>

        {/* Translation */}
        <section className="glass rounded-2xl px-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest pt-4 pb-2">
            Translation
          </p>
          <ToggleRow
            label="Show raw sign words"
            description="Display gloss under the natural sentence"
            icon={Eye}
            checked={settings.showRawWords}
            onChange={(v) => updateSettings({ showRawWords: v })}
          />
          <ToggleRow
            label="Live sign preview"
            description="Show detected words while you are still signing"
            icon={Eye}
            checked={settings.showLivePreview}
            onChange={(v) => updateSettings({ showLivePreview: v })}
          />
          <ToggleRow
            label="Auto-speak results"
            description="Read aloud after each translation (browser TTS)"
            icon={Volume2}
            checked={settings.autoSpeak}
            onChange={(v) => updateSettings({ autoSpeak: v })}
          />
          <div className="py-3 border-b border-border/60">
            <label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-primary" />
              Max recording hint ({settings.recordingDuration}s)
            </label>
            <input
              type="range"
              min={3}
              max={8}
              step={1}
              value={settings.recordingDuration}
              onChange={(e) =>
                updateSettings({ recordingDuration: parseInt(e.target.value, 10) })
              }
              className="w-full accent-primary"
            />
          </div>
        </section>

        {/* Reverse mode */}
        <section className="glass rounded-2xl px-5 pb-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest pt-4 pb-2">
            Reverse mode
          </p>
          <div className="py-3">
            <label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Gauge className="h-4 w-4 text-primary" />
              Default avatar speed ({settings.avatarSpeed}x)
            </label>
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
          </div>
          <div className="py-3">
            <label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Globe className="h-4 w-4 text-primary" />
              Sign language
            </label>
            <select
              value={settings.signLanguage}
              onChange={(e) =>
                updateSettings({
                  signLanguage: e.target.value as typeof settings.signLanguage,
                })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="ASL">ASL (American)</option>
              <option value="BSL" disabled>
                BSL — coming soon
              </option>
              <option value="ISL" disabled>
                ISL — coming soon
              </option>
            </select>
          </div>
        </section>

        {/* Offline & AI */}
        <section className="glass rounded-2xl p-5 space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            Offline &amp; AI models
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Wifi className="h-3.5 w-3.5" />
                Network
              </div>
              <p className={cn("font-semibold", isOnline ? "text-emerald-400" : "text-amber-400")}>
                {isOnline ? "Online" : "Offline"}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Download className="h-3.5 w-3.5" />
                MediaPipe
              </div>
              <p className={cn("font-semibold capitalize", mediapipeStatus === "ready" ? "text-emerald-400" : "text-muted-foreground")}>
                {mediapipeStatus === "ready" ? "Cached" : mediapipeStatus}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5 col-span-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Brain className="h-3.5 w-3.5" />
                Sign recognition
              </div>
              <p className="font-semibold text-primary">
                {lstmMode === "ready" ? "LSTM model active" : "Gesture classifier (train LSTM to upgrade)"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1">
                Cache: {modelProgress.overall}% · LSTM status: {lstmStatus}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={recaching}
            onClick={async () => {
              setRecaching(true);
              await recache();
              setRecaching(false);
            }}
            className="w-full rounded-xl border border-border py-2.5 text-sm font-medium hover:border-primary/40 hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {recaching ? "Downloading…" : "Re-download offline models"}
          </button>
          {canInstall && !isInstalled && (
            <button
              type="button"
              onClick={() => install()}
              className="w-full rounded-xl gradient-brand py-2.5 text-sm font-semibold text-white"
            >
              Install app (PWA)
            </button>
          )}
          {isInstalled && (
            <p className="text-xs text-emerald-400 text-center">App installed on this device</p>
          )}
        </section>

        <AccountPanel />

        <motion.button
          type="button"
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            resetSettings();
            setTheme(DEFAULT_SETTINGS.theme);
          }}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Reset all settings
        </motion.button>
      </div>
    </div>
  );
}
