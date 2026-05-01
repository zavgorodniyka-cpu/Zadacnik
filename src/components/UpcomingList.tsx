"use client";

import type { Task } from "@/types/task";
import { formatHumanDate } from "@/lib/dates";

type Props = {
  tasks: Task[];
  onSelectDate: (iso: string) => void;
};

export default function UpcomingList({ tasks, onSelectDate }: Props) {
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
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onSelectDate(t.dueDate as string)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-orange-100 dark:hover:bg-orange-900/30"
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
            </li>
            ) : null,
          )}
        </ul>
      )}
    </div>
  );
}
