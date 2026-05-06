"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

function urlBase64ToBufferSource(base64: string): BufferSource {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buffer = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token ?? null;
}

export default function PushButton() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setSupported(false);
      return;
    }
    setSupported(true);
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch (err) {
        console.warn("[push] check sub", err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  async function subscribe() {
    setHint(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setHint("Разреши уведомления в настройках сайта браузера.");
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) {
        setHint("Ключ NEXT_PUBLIC_VAPID_PUBLIC_KEY не настроен.");
        return;
      }
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBufferSource(publicKey),
        });
      }
      const token = await getAccessToken();
      if (!token) {
        setHint("Сначала войди в аккаунт.");
        await sub.unsubscribe().catch(() => {});
        return;
      }
      const subJson = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          userAgent: navigator.userAgent,
        }),
      });
      if (!res.ok) {
        setHint("Сервер не принял подписку. Попробуй ещё раз.");
        await sub.unsubscribe().catch(() => {});
        return;
      }
      setSubscribed(true);
      setHint("Готово! Уведомления будут приходить даже при закрытом приложении.");
    } catch (err) {
      console.error("[push] subscribe", err);
      setHint("Не получилось подписаться. Попробуй переустановить PWA.");
    } finally {
      setBusy(false);
    }
  }

  async function unsubscribe() {
    setHint(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        const token = await getAccessToken();
        if (token) {
          await fetch("/api/push/unsubscribe", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ endpoint }),
          });
        }
        await sub.unsubscribe();
      }
      setSubscribed(false);
      setHint("Пуши выключены на этом устройстве.");
    } catch (err) {
      console.error("[push] unsubscribe", err);
      setHint("Не получилось отписаться.");
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Пуши"
        title="Пуш-уведомления"
        className={[
          "rounded-lg border p-2 transition",
          subscribed
            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300"
            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900",
        ].join(" ")}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="8" height="12" rx="1.5" />
          <path d="M7 12h2" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Пуши на телефон
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={subscribed}
              disabled={busy}
              onClick={subscribed ? unsubscribe : subscribe}
              className={[
                "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition disabled:opacity-50",
                subscribed
                  ? "bg-blue-500"
                  : "bg-zinc-300 dark:bg-zinc-700",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                  subscribed ? "translate-x-4" : "translate-x-0.5",
                ].join(" ")}
              />
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            Утренняя сводка приходит как нативное уведомление, даже когда сайт закрыт.
          </p>
          <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            На iOS: установи сайт на главный экран (Поделиться → На экран Домой), потом включи пуши.
          </p>
          {hint && (
            <p className="mt-2 text-[11px] text-zinc-700 dark:text-zinc-300">
              {hint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
