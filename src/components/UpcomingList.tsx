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
    <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4 shadow-sm dark:border-orange-900/40 dark:bg-orange-950/30">
      <h2 className="mb-3 text-lg font-bold tracking-tight text-orange-500 dark:text-orange-400">
        Ближайшие
      </h2>

      {tasks.length === 0 ? (
        <p className="py-3 text-sm text-orange-700/60 dark:text-orange-300/50">
          Активных задач нет.
        </p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) =>
            t.dueDate ? (
            <li key={t.id} className="group flex items-center gap-1 rounded-lg transition hover:bg-orange-100 dark:hover:bg-orange-900/30">
              <button
                type="button"
                onClick={() => onEdit(t)}
                className="flex flex-1 items-center gap-3 px-2 py-2 text-left"
                aria-label={`Открыть задачу: ${t.title}`}
              >
                <span className="w-20 flex-none text-xs font-medium text-orange-700 dark:text-orange-300">
                  {formatHumanDate(t.dueDate)}
                </span>
                {t.dueTime && (
                  <span className="font-mono text-xs tabular-nums text-orange-700 dark:text-orange-300">
                    {t.dueTime}
                  </span>
                )}
                <span className="flex-1 truncate text-sm text-orange-950 dark:text-orange-100">
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
                className="flex-none rounded-md p-1.5 text-orange-700/70 opacity-0 transition hover:bg-orange-200 hover:text-orange-900 group-hover:opacity-100 dark:text-orange-300/70 dark:hover:bg-orange-900/50 dark:hover:text-orange-100"
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
