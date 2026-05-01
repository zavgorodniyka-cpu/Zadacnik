"use client";

import { useMemo, useState } from "react";
import { parseTask } from "@/lib/nlp";
import { formatHumanDate } from "@/lib/dates";

type Props = {
  onCreate: (data: {
    title: string;
    dueDate?: string;
    dueTime?: string;
    endTime?: string;
  }) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

export default function QuickAdd({ onCreate, inputRef }: Props) {
  const [text, setText] = useState("");

  const preview = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    return parseTask(trimmed);
  }, [text]);

  const hasParsedExtras = !!(preview && (preview.dueDate || preview.dueTime));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || !preview.title) return;
    onCreate({
      title: preview.title,
      dueDate: preview.dueDate,
      dueTime: preview.dueTime,
      endTime: preview.endTime,
    });
    setText("");
  }

  return (
    <form onSubmit={submit} className="relative w-full max-w-xs">
      <div className="flex items-center rounded-lg border border-zinc-200 bg-white shadow-sm transition focus-within:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-50">
        <span className="pl-3 pr-1 text-zinc-400">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </span>
        <span className="select-none whitespace-nowrap pr-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Умный ввод ·
        </span>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="завтра в 15…"
          className="flex-1 min-w-0 bg-transparent py-2 pr-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
      </div>
      {hasParsedExtras && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-zinc-200 bg-white p-2 text-xs shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-zinc-500 dark:text-zinc-400">Распознал:</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <span className="font-medium">{preview!.title || "(без названия)"}</span>
            {preview!.dueDate && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                {formatHumanDate(preview!.dueDate)}
              </span>
            )}
            {preview!.dueTime && (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono tabular-nums text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                {preview!.dueTime}
                {preview!.endTime ? `–${preview!.endTime}` : ""}
              </span>
            )}
            <span className="text-zinc-400 dark:text-zinc-600">↵ создать</span>
          </div>
        </div>
      )}
    </form>
  );
}
