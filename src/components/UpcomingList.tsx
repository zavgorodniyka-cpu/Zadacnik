"use client";

import type { Task } from "@/types/task";
import { formatHumanDate } from "@/lib/dates";

type Props = {
  tasks: Task[];
  onSelectDate: (iso: string) => void;
  onEdit: (task: Task) => void;
};

export default function UpcomingList({ tasks, onSelectDate, onEdit }: Props) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-orange-600 dark:text-orange-400">
        Ближайшие
      </h2>

      {tasks.length === 0 ? (
        <p className="py-3 text-sm text-zinc-500 dark:text-zinc-400">
          Активных задач нет.
        </p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) =>
            t.dueDate ? (
            <li key={t.id} className="group flex items-center gap-1 rounded-lg transition hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
              <button
                type="button"
                onClick={() => onEdit(t)}
                className="flex flex-1 items-center gap-3 px-2 py-2 text-left"
                aria-label={`Открыть задачу: ${t.title}`}
              >
                <span className="w-20 flex-none text-xs font-medium text-orange-600 dark:text-orange-400">
                  {formatHumanDate(t.dueDate)}
                </span>
                {t.dueTime && (
                  <span className="font-mono text-xs tabular-nums text-orange-600 dark:text-orange-400">
                    {t.dueTime}
                  </span>
                )}
                <span className="flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">
                  {t.priority === "high" && (
                    <svg viewBox="0 0 16 16" className="mr-1 inline-block h-3 w-3 -translate-y-px text-red-500" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 2v12M3 3h8l-1.5 3L11 9H3" />
                    </svg>
                  )}
                  {t.title}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onSelectDate(t.dueDate as string)}
                aria-label="Показать в календаре"
                title="Показать в календаре"
                className="flex-none rounded-md p-1.5 text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-900 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="12" height="11" rx="1.5" />
                  <path d="M2 6h12M5.5 1.5v3M10.5 1.5v3" />
                </svg>
              </button>
            </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  );
}
