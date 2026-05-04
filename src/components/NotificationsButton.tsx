"use client";

import { useEffect, useRef, useState } from "react";
import {
  currentPermission,
  isSupported,
  requestPermission,
  type NotificationSettings,
} from "@/lib/notifications";

type Props = {
  settings: NotificationSettings;
  onChange: (s: NotificationSettings) => void;
};

export default function NotificationsButton({ settings, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPermission(currentPermission());
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

  const supported = isSupported();
  const isOn = settings.enabled && permission === "granted";

  async function handleToggle() {
    if (!isOn) {
      const result = await requestPermission();
      setPermission(result);
      onChange({ enabled: result === "granted" });
    } else {
      onChange({ enabled: false });
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Уведомления"
        title="Уведомления"
        className={[
          "rounded-lg border p-2 transition",
          isOn
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
            : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900",
        ].join(" ")}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill={isOn ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v1M4 6a4 4 0 018 0c0 4 1.5 5 1.5 5h-11S4 10 4 6zM6.5 13a1.5 1.5 0 003 0" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {!supported ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Браузер не поддерживает уведомления.
            </p>
          ) : permission === "denied" ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Уведомления заблокированы. Разреши их в настройках сайта браузера.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  Уведомления
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  onClick={handleToggle}
                  className={[
                    "relative inline-flex h-5 w-9 flex-none items-center rounded-full transition",
                    isOn
                      ? "bg-emerald-500"
                      : "bg-zinc-300 dark:bg-zinc-700",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                      isOn ? "translate-x-4" : "translate-x-0.5",
                    ].join(" ")}
                  />
                </button>
              </div>

              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                Главный переключатель. Сами напоминания включаются у каждой задачи отдельно — кликни 🔔 в строке задачи или включи в форме.
              </p>

              <p className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                Работает, пока вкладка открыта. Фоновые уведомления — на следующем шаге (PWA).
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
