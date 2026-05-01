"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/types/task";
import type { Anniversary } from "@/types/anniversary";
import {
  RU_MONTHS,
  RU_WEEKDAYS_SHORT,
  buildMonthGrid,
  isSameDay,
  toISODate,
} from "@/lib/dates";
import { getHoliday } from "@/lib/holidays";
import { getOccurrencesInRange } from "@/lib/anniversaries";

type Props = {
  tasks: Task[];
  anniversaries: Anniversary[];
  selectedDate: string;
  onSelectDate: (iso: string) => void;
};

export default function Calendar({ tasks, anniversaries, selectedDate, onSelectDate }: Props) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));

  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      map.set(t.dueDate, (map.get(t.dueDate) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const anniversariesByDate = useMemo(() => {
    if (grid.length === 0) return new Map<string, Anniversary[]>();
    return getOccurrencesInRange(anniversaries, grid[0], grid[grid.length - 1]);
  }, [anniversaries, grid]);

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.year, v.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToToday() {
    setView({ year: today.getFullYear(), month: today.getMonth() });
    onSelectDate(toISODate(today));
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {RU_MONTHS[view.month]} {view.year}
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            aria-label="Предыдущий месяц"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Сегодня
          </button>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            aria-label="Следующий месяц"
          >
            →
          </button>
        </div>
      </div>

      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {RU_WEEKDAYS_SHORT.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === view.month;
          const isToday = isSameDay(d, today);
          const isSelected = iso === selectedDate;
          const hasTasks = (tasksByDate.get(iso) ?? 0) > 0;
          const dayAnniversaries = anniversariesByDate.get(iso);
          const holiday = getHoliday(iso);
          const dow = d.getDay();
          const isWeekend = dow === 0 || dow === 6;
          const isNonWorking = !!holiday || isWeekend;

          let stateClass: string;
          if (isSelected) {
            stateClass =
              "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900";
          } else if (isNonWorking) {
            stateClass =
              "border-emerald-200/70 bg-emerald-100/60 hover:bg-emerald-100 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:hover:bg-emerald-950/60";
          } else if (hasTasks) {
            stateClass =
              "border-red-200/70 bg-red-100/60 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:hover:bg-red-950/60";
          } else if (isToday) {
            stateClass =
              "border-zinc-900 bg-transparent dark:border-zinc-50";
          } else {
            stateClass =
              "border-transparent hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-900";
          }

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              title={holiday}
              className={[
                "relative flex h-20 flex-col items-center justify-center rounded-lg border text-base transition",
                inMonth
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-400 dark:text-zinc-600",
                stateClass,
                isToday && !isSelected ? "ring-1 ring-zinc-900 dark:ring-zinc-50" : "",
              ].join(" ")}
            >
              <span className="font-medium leading-none">{d.getDate()}</span>
              {dayAnniversaries && dayAnniversaries.length > 0 && (
                <span
                  className="absolute right-1 top-1 text-[12px] leading-none"
                  title={dayAnniversaries.map((a) => a.title).join(", ")}
                >
                  {dayAnniversaries[0].emoji ?? "📌"}
                </span>
              )}
              {hasTasks && isNonWorking && !isSelected && (
                <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
