"use client";

import { useMemo, useState } from "react";
import type { Anniversary } from "@/types/anniversary";
import type { Reminder, ReminderMode, Task } from "@/types/task";
import { fromISODate, formatHumanDate } from "@/lib/dates";
import { getOccurrencesInRange } from "@/lib/anniversaries";
import { getHoliday } from "@/lib/holidays";
import PriorityFlag from "./PriorityFlag";
import ReminderButton from "./ReminderButton";
import SnoozeMenu from "./SnoozeMenu";
import TagPill from "./TagPill";

type Props = {
  tasks: Task[];
  anniversaries?: Anniversary[];
  selectedDate: string;
  reminderDefaults: { mode: ReminderMode; time: string };
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onTogglePriority: (id: string) => void;
  onSnooze: (id: string, dueDate: string) => void;
  onSetReminder: (id: string, reminder: Reminder | undefined) => void;
  onAnniversaryClick?: () => void;
};

export default function TaskList({
  tasks,
  anniversaries,
  selectedDate,
  reminderDefaults,
  onToggle,
  onEdit,
  onDelete,
  onTogglePriority,
  onSnooze,
  onSetReminder,
  onAnniversaryClick,
}: Props) {
  const [showDone, setShowDone] = useState(false);

  const dayTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate === selectedDate)
        .sort((a, b) => {
          if (a.status !== b.status) return a.status === "done" ? 1 : -1;
          // По времени: задачи без времени уходят в конец дня.
          const at = a.dueTime ?? "99:99";
          const bt = b.dueTime ?? "99:99";
          if (at !== bt) return at.localeCompare(bt);
          return a.createdAt.localeCompare(b.createdAt);
        }),
    [tasks, selectedDate],
  );

  const dayAnniversaries = useMemo(() => {
    if (!anniversaries || anniversaries.length === 0) return [] as Anniversary[];
    const date = fromISODate(selectedDate);
    const occ = getOccurrencesInRange(anniversaries, date, date);
    return occ.get(selectedDate) ?? [];
  }, [anniversaries, selectedDate]);

  const holiday = useMemo(() => getHoliday(selectedDate), [selectedDate]);

  const pending = dayTasks.filter((t) => t.status !== "done");
  const done = dayTasks.filter((t) => t.status === "done");
  const total = dayTasks.length;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {formatHumanDate(selectedDate)}
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {total === 0
            ? "Нет задач"
            : done.length > 0
              ? `${pending.length} из ${total}`
              : `${total} ${declineTasks(total)}`}
        </span>
      </div>

      {holiday && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <span className="text-base leading-none">⭐</span>
          <span className="flex-1 truncate text-sm font-medium text-emerald-900 dark:text-emerald-200">
            {holiday}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-emerald-700/70 dark:text-emerald-300/70">
            праздник
          </span>
        </div>
      )}

      {dayAnniversaries.length > 0 && (
        <ul className="mb-2 space-y-1">
          {dayAnniversaries.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                onClick={onAnniversaryClick}
                className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left transition hover:bg-amber-100 dark:border-amber-900/40 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
                title="Открыть «Напоминания»"
              >
                <span className="text-base leading-none">{a.emoji ?? "📌"}</span>
                <span className="flex-1 truncate text-sm font-medium text-amber-900 dark:text-amber-200">
                  {a.title}
                </span>
                {a.notes && (
                  <span className="truncate text-xs text-amber-700/80 dark:text-amber-300/70">
                    {a.notes}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {total === 0 && dayAnniversaries.length === 0 && !holiday ? (
        <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
          Свободный день. Можно добавить задачу справа.
        </p>
      ) : (
        <>
          {pending.length > 0 && (
            <ul className="space-y-1.5">
              {pending.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  reminderDefaults={reminderDefaults}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onTogglePriority={onTogglePriority}
                  onSnooze={onSnooze}
                  onSetReminder={onSetReminder}
                />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <div className={pending.length > 0 ? "mt-2" : ""}>
              <button
                type="button"
                onClick={() => setShowDone((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <svg
                  viewBox="0 0 16 16"
                  className={[
                    "h-3.5 w-3.5 transition",
                    showDone ? "rotate-90" : "",
                  ].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 4l5 4-5 4" />
                </svg>
                Выполненные ({done.length})
              </button>

              {showDone && (
                <ul className="mt-1 space-y-1.5">
                  {done.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      reminderDefaults={reminderDefaults}
                      onToggle={onToggle}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onTogglePriority={onTogglePriority}
                      onSnooze={onSnooze}
                      onSetReminder={onSetReminder}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({
  task: t,
  reminderDefaults,
  onToggle,
  onEdit,
  onDelete,
  onTogglePriority,
  onSnooze,
  onSetReminder,
}: {
  task: Task;
  reminderDefaults: { mode: ReminderMode; time: string };
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onTogglePriority: (id: string) => void;
  onSnooze: (id: string, dueDate: string) => void;
  onSetReminder: (id: string, reminder: Reminder | undefined) => void;
}) {
  const done = t.status === "done";
  return (
    <li
      className="group flex items-start gap-3 rounded-lg border border-transparent px-2 py-2 transition hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <button
        type="button"
        onClick={() => onToggle(t.id)}
        aria-label={done ? "Отметить невыполненной" : "Отметить выполненной"}
        className={[
          "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border transition",
          done
            ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
            : "border-zinc-300 hover:border-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-50",
        ].join(" ")}
      >
        {done && (
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l3.5 3.5L13 5" />
          </svg>
        )}
      </button>

      <button
        type="button"
        onClick={() => onEdit(t)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2">
          {t.dueTime && (
            <span
              className={[
                "font-mono text-xs tabular-nums",
                done
                  ? "text-zinc-400 line-through dark:text-zinc-600"
                  : "text-zinc-500 dark:text-zinc-400",
              ].join(" ")}
            >
              {t.dueTime}
              {t.endTime ? `–${t.endTime}` : ""}
            </span>
          )}
          <span
            className={[
              "text-sm",
              done
                ? "text-zinc-400 line-through dark:text-zinc-600"
                : "text-zinc-900 dark:text-zinc-100",
            ].join(" ")}
          >
            {t.title}
          </span>
          {t.recurringId && (
            <span
              className="text-[11px] text-zinc-400 dark:text-zinc-500"
              title="Часть повторяющейся серии"
            >
              🔁
            </span>
          )}
        </div>
        {t.description && (
          <p
            className={[
              "mt-0.5 truncate text-xs",
              done
                ? "text-zinc-400 dark:text-zinc-600"
                : "text-zinc-500 dark:text-zinc-400",
            ].join(" ")}
          >
            {t.description}
          </p>
        )}
        {t.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {t.tags.map((tag) => (
              <TagPill key={tag} tag={tag} muted={done} />
            ))}
          </div>
        )}
        {t.subtasks && t.subtasks.length > 0 && (
          <span className="mt-1 inline-block text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
            ✓ {t.subtasks.filter((s) => s.done).length}/{t.subtasks.length}
          </span>
        )}
      </button>

      <PriorityFlag
        isHigh={t.priority === "high"}
        onToggle={() => onTogglePriority(t.id)}
      />
      <ReminderButton
        reminder={t.reminder}
        defaults={reminderDefaults}
        onChange={(r) => onSetReminder(t.id, r)}
        disabled={!t.dueDate}
      />
      <SnoozeMenu onPick={(iso) => onSnooze(t.id, iso)} />
      <button
        type="button"
        onClick={() => onDelete(t.id)}
        aria-label="Удалить"
        className="flex-none rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 4h10M6 4V2.5A.5.5 0 016.5 2h3a.5.5 0 01.5.5V4M5 4l.5 9a1 1 0 001 1h3a1 1 0 001-1L11 4" />
        </svg>
      </button>
    </li>
  );
}

function declineTasks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "задача";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "задачи";
  return "задач";
}
