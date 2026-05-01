"use client";

import { useEffect } from "react";

export default function PWAInit() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore — PWA is non-critical
    });
  }, []);
  return null;
}
