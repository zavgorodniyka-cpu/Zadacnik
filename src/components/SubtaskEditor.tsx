"use client";

import { useState } from "react";
import type { Subtask } from "@/types/task";
import { generateId } from "@/lib/storage";

type Props = {
  subtasks: Subtask[];
  onChange: (next: Subtask[]) => void;
};

export default function SubtaskEditor({ subtasks, onChange }: Props) {
  const [draft, setDraft] = useState("");

  function add() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onChange([
      ...subtasks,
      { id: generateId(), title: trimmed, done: false },
    ]);
    setDraft("");
  }

  function toggle(id: string) {
    onChange(
      subtasks.map((s) => (s.id === id ? { ...s, done: !s.done } : s)),
    );
  }

  function remove(id: string) {
    onChange(subtasks.filter((s) => s.id !== id));
  }

  function updateTitle(id: string, title: string) {
    onChange(subtasks.map((s) => (s.id === id ? { ...s, title } : s)));
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
        Подзадачи
      </label>
      {subtasks.length > 0 && (
        <ul className="mb-2 space-y-1">
          {subtasks.map((s) => (
            <li
              key={s.id}
              className="group flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-950"
            >
              <button
                type="button"
                onClick={() => toggle(s.id)}
                aria-label={s.done ? "Снять отметку" : "Выполнить"}
                className={[
                  "flex h-4 w-4 flex-none items-center justify-center rounded-md border transition",
                  s.done
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-300 hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-50",
                ].join(" ")}
              >
                {s.done && (
                  <svg viewBox="0 0 16 16" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8l3.5 3.5L13 5" />
                  </svg>
                )}
              </button>
              <input
                type="text"
                value={s.title}
                onChange={(e) => updateTitle(s.id, e.target.value)}
                className={[
                  "flex-1 bg-transparent text-sm outline-none",
                  s.done
                    ? "text-zinc-400 line-through dark:text-zinc-600"
                    : "text-zinc-900 dark:text-zinc-100",
                ].join(" ")}
              />
              <button
                type="button"
                onClick={() => remove(s.id)}
                aria-label="Удалить"
                className="flex-none rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="Добавить пункт…"
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          +
        </button>
      </div>
    </div>
  );
}
