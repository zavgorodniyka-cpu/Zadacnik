"use client";

import { useEffect, useRef, useState } from "react";
import type { Reminder, ReminderMode } from "@/types/task";

type Props = {
  reminder: Reminder | undefined;
  defaults: { mode: ReminderMode; time: string };
  onChange: (next: Reminder | undefined) => void;
  disabled?: boolean;
};

export default function ReminderButton({
  reminder,
  defaults,
  onChange,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

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

  const isOn = !!reminder;

  function setMode(mode: ReminderMode) {
    onChange({ mode, time: reminder?.time ?? defaults.time });
  }

  function setTime(time: string) {
    onChange({ mode: reminder?.mode ?? defaults.mode, time });
  }

  function clear() {
    onChange(undefined);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((v) => !v);
        }}
        aria-label={isOn ? "Изменить напоминание" : "Добавить напоминание"}
        title={
          isOn
            ? `Напомню ${reminder!.mode === "day_before" ? "за день" : "в день"} в ${reminder!.time}`
            : "Напоминание"
        }
        className={[
          "flex-none rounded-md p-1 transition",
          isOn
            ? "text-emerald-600 opacity-100 hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            : "text-zinc-400 opacity-0 hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
          disabled ? "cursor-not-allowed opacity-30" : "",
        ].join(" ")}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill={isOn ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 2v1M4 6a4 4 0 018 0c0 4 1.5 5 1.5 5h-11S4 10 4 6zM6.5 13a1.5 1.5 0 003 0" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Когда напомнить
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              type="button"
              onClick={() => setMode("day_before")}
              className={[
                "rounded-md px-2 py-1.5 text-xs font-medium transition",
                reminder?.mode === "day_before"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              За день
            </button>
            <button
              type="button"
              onClick={() => setMode("same_day")}
              className={[
                "rounded-md px-2 py-1.5 text-xs font-medium transition",
                reminder?.mode === "same_day"
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              День в день
            </button>
          </div>

          <label className="mt-2 mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Во сколько
          </label>
          <input
            type="time"
            value={reminder?.time ?? defaults.time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />

          {isOn && (
            <button
              type="button"
              onClick={clear}
              className="mt-3 block w-full rounded-md px-2 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Не напоминать
            </button>
          )}
        </div>
      )}
    </div>
  );
}
