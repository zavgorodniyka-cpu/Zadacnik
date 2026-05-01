"use client";

import { useEffect, useRef, useState } from "react";
import { toISODate } from "@/lib/dates";

type Props = {
  onPick: (iso: string) => void;
};

export default function SnoozeMenu({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

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

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const inWeek = new Date(today);
  inWeek.setDate(today.getDate() + 7);
  const nextMon = new Date(today);
  const dow = today.getDay();
  nextMon.setDate(today.getDate() + ((1 - dow + 7) % 7 || 7));

  const options: Array<{ label: string; iso: string }> = [
    { label: "Завтра", iso: toISODate(tomorrow) },
    { label: "Через неделю", iso: toISODate(inWeek) },
    { label: "След. понедельник", iso: toISODate(nextMon) },
  ];

  function pick(iso: string) {
    onPick(iso);
    setOpen(false);
  }

  function openCustom() {
    const el = dateRef.current;
    if (!el) return;
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      el.click();
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Перенести"
        title="Перенести"
        className="flex-none rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8h10M9 4l4 4-4 4" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => pick(o.iso)}
              className="block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-900 transition hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {o.label}
            </button>
          ))}
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
          <button
            type="button"
            onClick={openCustom}
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Выбрать дату…
          </button>
          <input
            ref={dateRef}
            type="date"
            className="sr-only"
            onChange={(e) => {
              if (e.target.value) pick(e.target.value);
              e.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}
