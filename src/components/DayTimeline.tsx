"use client";

import { useMemo, useState } from "react";
import type { Task } from "@/types/task";
import { formatHumanDate } from "@/lib/dates";

type Props = {
  tasks: Task[];
  selectedDate: string;
  onTaskClick: (task: Task) => void;
  onSlotClick: (time: string) => void;
};

const START_HOUR = 8;
const END_HOUR = 22;
const PX_PER_HOUR = 48;
const SNAP_MINUTES = 30;
const TIMELINE_HEIGHT = (END_HOUR - START_HOUR) * PX_PER_HOUR;

function timeToY(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const minutes = (h - START_HOUR) * 60 + m;
  return Math.max(0, (minutes / 60) * PX_PER_HOUR);
}

function clampToTimelineEnd(time: string): number {
  const y = timeToY(time);
  return Math.min(y, TIMELINE_HEIGHT);
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function yToSnappedTime(y: number): { time: string; snappedY: number } | null {
  const minutesFromStart = (y / PX_PER_HOUR) * 60;
  const snapped = Math.round(minutesFromStart / SNAP_MINUTES) * SNAP_MINUTES;
  const total = START_HOUR * 60 + snapped;
  if (total < START_HOUR * 60 || total >= END_HOUR * 60) return null;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return {
    time: `${pad(h)}:${pad(m)}`,
    snappedY: (snapped / 60) * PX_PER_HOUR,
  };
}

export default function DayTimeline({
  tasks,
  selectedDate,
  onTaskClick,
  onSlotClick,
}: Props) {
  const [hover, setHover] = useState<{ time: string; y: number } | null>(null);

  const dayTasks = useMemo(
    () =>
      tasks.filter(
        (t) => t.dueDate === selectedDate && t.dueTime && t.status !== "done",
      ),
    [tasks, selectedDate],
  );

  const hours = Array.from(
    { length: END_HOUR - START_HOUR + 1 },
    (_, i) => i + START_HOUR,
  );

  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const result = yToSnappedTime(y);
    if (result) setHover({ time: result.time, y: result.snappedY });
    else setHover(null);
  }

  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const result = yToSnappedTime(y);
    if (result) onSlotClick(result.time);
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {formatHumanDate(selectedDate)} · день
      </h2>

      <div
        className="relative cursor-pointer"
        style={{ height: TIMELINE_HEIGHT + PX_PER_HOUR / 2 }}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        onClick={handleClick}
      >
        {/* Hour labels and grid lines */}
        {hours.map((h) => {
          const top = (h - START_HOUR) * PX_PER_HOUR;
          return (
            <div
              key={h}
              className="pointer-events-none absolute left-0 right-0 flex items-start"
              style={{ top }}
            >
              <span className="w-10 flex-none font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600">
                {String(h).padStart(2, "0")}:00
              </span>
              <div className="ml-2 flex-1 border-t border-zinc-100 dark:border-zinc-800/60" />
            </div>
          );
        })}

        {/* Hover indicator */}
        {hover && (
          <div
            className="pointer-events-none absolute left-0 right-0 flex items-center"
            style={{ top: hover.y }}
          >
            <span className="ml-1 rounded bg-zinc-900 px-1 py-0.5 font-mono text-[10px] text-white shadow dark:bg-zinc-50 dark:text-zinc-900">
              + {hover.time}
            </span>
            <div className="ml-1 flex-1 border-t border-dashed border-zinc-400 dark:border-zinc-500" />
          </div>
        )}

        {/* Task blocks */}
        {dayTasks.map((t) => {
          const top = timeToY(t.dueTime!);
          const bottom = t.endTime
            ? clampToTimelineEnd(t.endTime)
            : Math.min(top + PX_PER_HOUR / 2, TIMELINE_HEIGHT);
          const height = Math.max(bottom - top, 22);
          const isHigh = t.priority === "high";
          return (
            <button
              key={t.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onTaskClick(t);
              }}
              onMouseEnter={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              className={[
                "absolute left-12 right-1 z-10 cursor-pointer rounded-md border px-2 py-1 text-left text-xs shadow-sm transition",
                isHigh
                  ? "border-red-300 bg-red-50 text-red-900 hover:border-red-400 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100 dark:hover:border-red-700 dark:hover:bg-red-950/60"
                  : "border-zinc-300 bg-zinc-100 text-zinc-900 hover:border-zinc-500 hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:hover:bg-zinc-700",
              ].join(" ")}
              style={{ top, height }}
              title={t.title}
            >
              <div className="flex items-center gap-2 leading-tight">
                <span className="font-mono tabular-nums opacity-70">
                  {t.dueTime}
                  {t.endTime ? `–${t.endTime}` : ""}
                </span>
              </div>
              <div className="mt-0.5 truncate font-medium leading-tight">
                {t.title}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
