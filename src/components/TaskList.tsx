"use client";

import type { Reminder, ReminderMode, Task } from "@/types/task";
import { formatHumanDate } from "@/lib/dates";
import PriorityFlag from "./PriorityFlag";
import ReminderButton from "./ReminderButton";
import SnoozeMenu from "./SnoozeMenu";
import TagPill from "./TagPill";

type Props = {
  tasks: Task[];
  selectedDate: string;
  reminderDefaults: { mode: ReminderMode; time: string };
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onTogglePriority: (id: string) => void;
  onSnooze: (id: string, dueDate: string) => void;
  onSetReminder: (id: string, reminder: Reminder | undefined) => void;
};

export default function TaskList({
  tasks,
  selectedDate,
  reminderDefaults,
  onToggle,
  onEdit,
  onDelete,
  onTogglePriority,
  onSnooze,
  onSetReminder,
}: Props) {
  const dayTasks = tasks
    .filter((t) => t.dueDate === selectedDate)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "done" ? 1 : -1;
      const ap = a.priority === "high" ? 0 : 1;
      const bp = b.priority === "high" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      const at = a.dueTime ?? "99:99";
      const bt = b.dueTime ?? "99:99";
      return at.localeCompare(bt);
    });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {formatHumanDate(selectedDate)}
        </h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {dayTasks.length === 0
            ? "Нет задач"
            : `${dayTasks.length} ${declineTasks(dayTasks.length)}`}
        </span>
      </div>

      {dayTasks.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400 dark:text-zinc-600">
          Свободный день. Можно добавить задачу справа.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {dayTasks.map((t) => {
            const done = t.status === "done";
            return (
              <li
                key={t.id}
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
          })}
        </ul>
      )}
    </div>
  );
}

function declineTasks(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "задача";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "задачи";
  return "задач";
}
