"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Cloud, CloudUpload, CloudDownload, LogIn, LogOut, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useAppStore } from "@/stores/appStore";
import { cn } from "@/lib/cn";

export function AccountPanel() {
  const { user, token, login, register, logout, syncToCloud, pullFromCloud, syncStatus, syncMessage } =
    useAuthStore();
  const { sessions } = useAppStore();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, displayName || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    setError(null);
    try {
      await syncToCloud(sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handlePull = async () => {
    setError(null);
    try {
      const cloud = await pullFromCloud();
      useAppStore.setState({ sessions: cloud, activeSession: cloud[0] ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  return (
    <section className="glass rounded-2xl p-5 space-y-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest flex items-center gap-2">
        <Cloud className="h-3.5 w-3.5" />
        Cloud account (MongoDB)
      </p>

      {user && token ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
            <User className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{user.displayName || user.email}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handlePush}
              disabled={syncStatus === "syncing"}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold hover:border-primary/40"
            >
              <CloudUpload className="h-4 w-4" />
              Upload history
            </button>
            <button
              type="button"
              onClick={handlePull}
              disabled={syncStatus === "syncing"}
              className="flex items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-xs font-semibold hover:border-primary/40"
            >
              <CloudDownload className="h-4 w-4" />
              Download history
            </button>
          </div>

          {syncMessage && (
            <p
              className={cn(
                "text-xs text-center",
                syncStatus === "error" ? "text-destructive" : "text-emerald-400"
              )}
            >
              {syncMessage}
            </p>
          )}

          <button
            type="button"
            onClick={() => logout()}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-sm text-muted-foreground hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      ) : (
        <form onSubmit={handleAuth} className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold border",
                mode === "login" ? "border-primary bg-primary/10 text-primary" : "border-border"
              )}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold border",
                mode === "register" ? "border-primary bg-primary/10 text-primary" : "border-border"
              )}
            >
              Register
            </button>
          </div>

          {mode === "register" && (
            <input
              type="text"
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="password"
            placeholder="Password (6+ characters)"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />

          {error && <p className="text-xs text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl gradient-brand py-2.5 text-sm font-semibold text-white"
          >
            <LogIn className="h-4 w-4" />
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <p className="text-[10px] text-muted-foreground text-center">
            Requires backend running + MongoDB Atlas. Set NEXT_PUBLIC_API_URL in .env.local
          </p>
        </form>
      )}
    </section>
  );
}
