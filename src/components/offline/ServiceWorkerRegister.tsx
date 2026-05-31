"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        console.info("[PWA] Service worker registered", reg.scope);
      })
      .catch((err) => {
        console.warn("[PWA] SW registration failed:", err);
      });
  }, []);

  return null;
}
