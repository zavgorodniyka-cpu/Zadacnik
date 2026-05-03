"use client";

import { useEffect } from "react";

export default function PWAInit() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // ignore — PWA is non-critical
    });
  }, []);
  return null;
}
