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
  const [viewMode, setViewMode] = useState<"month" | "year">("month");

  const grid = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks) {
      if (!t.dueDate) continue;
      map.set(t.dueDate, (map.get(t.dueDate) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  // Для года считаем юбилеи на весь год сразу (12 месяцев — диапазон шире, чем grid).
  const yearAnniversariesByDate = useMemo(() => {
    if (viewMode !== "year") return new Map<string, Anniversary[]>();
    const start = new Date(view.year, 0, 1);
    const end = new Date(view.year, 11, 31);
    return getOccurrencesInRange(anniversaries, start, end);
  }, [anniversaries, view.year, viewMode]);

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

  function shiftYear(delta: number) {
    setView((v) => ({ year: v.year + delta, month: v.month }));
  }

  function goToToday() {
    setView({ year: today.getFullYear(), month: today.getMonth() });
    onSelectDate(toISODate(today));
    setViewMode("month");
  }

  function openMonth(year: number, month: number) {
    setView({ year, month });
    setViewMode("month");
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {viewMode === "month" ? `${RU_MONTHS[view.month]} ${view.year}` : view.year}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-800">
            {(["month", "year"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setViewMode(m)}
                className={[
                  "rounded-md px-2.5 py-1 text-xs font-medium transition",
                  viewMode === m
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                {m === "month" ? "Месяц" : "Год"}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => (viewMode === "month" ? shiftMonth(-1) : shiftYear(-1))}
              className="rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              aria-label={viewMode === "month" ? "Предыдущий месяц" : "Предыдущий год"}
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
              onClick={() => (viewMode === "month" ? shiftMonth(1) : shiftYear(1))}
              className="rounded-lg p-2 text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
              aria-label={viewMode === "month" ? "Следующий месяц" : "Следующий год"}
            >
              →
            </button>
          </div>
        </div>
      </div>

      {viewMode === "year" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 12 }, (_, m) => (
            <MiniMonth
              key={m}
              year={view.year}
              month={m}
              today={today}
              selectedDate={selectedDate}
              tasksByDate={tasksByDate}
              anniversariesByDate={yearAnniversariesByDate}
              onMonthClick={() => openMonth(view.year, m)}
              onDayClick={(iso) => {
                onSelectDate(iso);
                openMonth(view.year, m);
              }}
            />
          ))}
        </div>
      ) : (
        <>
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
                "relative flex h-12 flex-col items-center justify-center rounded-lg border text-sm transition sm:h-20 sm:text-base",
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
              {holiday && (
                <span
                  className={[
                    "pointer-events-none absolute inset-x-0.5 bottom-0.5 truncate px-1 text-[9px] leading-tight sm:text-[10px]",
                    isSelected
                      ? "text-emerald-100 dark:text-emerald-300"
                      : "text-emerald-700 dark:text-emerald-300",
                  ].join(" ")}
                >
                  {holiday}
                </span>
              )}
              {hasTasks && isNonWorking && !isSelected && !holiday && (
                <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>
        </>
      )}
    </div>
  );
}

function MiniMonth({
  year,
  month,
  today,
  selectedDate,
  tasksByDate,
  anniversariesByDate,
  onMonthClick,
  onDayClick,
}: {
  year: number;
  month: number;
  today: Date;
  selectedDate: string;
  tasksByDate: Map<string, number>;
  anniversariesByDate: Map<string, Anniversary[]>;
  onMonthClick: () => void;
  onDayClick: (iso: string) => void;
}) {
  const grid = buildMonthGrid(year, month);
  return (
    <div className="rounded-lg border border-zinc-200 p-2 transition hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700">
      <button
        type="button"
        onClick={onMonthClick}
        className="mb-1 w-full text-left text-sm font-semibold text-zinc-900 transition hover:text-blue-600 dark:text-zinc-100 dark:hover:text-blue-400"
      >
        {RU_MONTHS[month]}
      </button>
      <div className="grid grid-cols-7 gap-px text-center text-[9px] text-zinc-400 dark:text-zinc-600">
        {RU_WEEKDAYS_SHORT.map((d) => (
          <div key={d}>{d[0]}</div>
        ))}
      </div>
      <div className="mt-0.5 grid grid-cols-7 gap-px">
        {grid.map((d) => {
          const iso = toISODate(d);
          const inMonth = d.getMonth() === month;
          const isToday = isSameDay(d, today);
          const isSelected = iso === selectedDate;
          const hasTasks = (tasksByDate.get(iso) ?? 0) > 0;
          const hasAnniversary = (anniversariesByDate.get(iso)?.length ?? 0) > 0;
          const holiday = getHoliday(iso);
          const isNonWorking = !!holiday || d.getDay() === 0 || d.getDay() === 6;

          let cls: string;
          if (!inMonth) {
            cls = "text-zinc-300 dark:text-zinc-700";
          } else if (isSelected) {
            cls = "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900";
          } else if (isToday) {
            cls = "ring-1 ring-zinc-900 dark:ring-zinc-50 text-zinc-900 dark:text-zinc-50";
          } else if (holiday) {
            cls = "text-emerald-700 dark:text-emerald-400";
          } else if (isNonWorking) {
            cls = "text-emerald-600/70 dark:text-emerald-500/70";
          } else {
            cls = "text-zinc-700 dark:text-zinc-300";
          }

          return (
            <button
              key={iso}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDayClick(iso);
              }}
              title={holiday}
              className={[
                "relative flex h-5 items-center justify-center rounded text-[10px] transition hover:bg-zinc-100 dark:hover:bg-zinc-800",
                cls,
              ].join(" ")}
            >
              {d.getDate()}
              {(hasTasks || hasAnniversary) && inMonth && !isSelected && (
                <span className="absolute -bottom-0.5 left-1/2 h-0.5 w-0.5 -translate-x-1/2 rounded-full bg-red-500" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
