"use client";

import { useState } from "react";
import type { Reminder, ReminderMode, Task } from "@/types/task";
import { formatHumanDate } from "@/lib/dates";
import PriorityFlag from "./PriorityFlag";
import ReminderButton from "./ReminderButton";
import SnoozeMenu from "./SnoozeMenu";
import TagPill from "./TagPill";

type Props = {
  tasks: Task[];
  reminderDefaults: { mode: ReminderMode; time: string };
  search: string;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSearchChange: (s: string) => void;
  onAdd: (title: string) => void;
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onSchedule: (id: string, dueDate: string) => void;
  onTogglePriority: (id: string) => void;
  onSetReminder: (id: string, reminder: Reminder | undefined) => void;
};

export default function DatelessList({
  tasks,
  reminderDefaults,
  search,
  searchInputRef,
  onSearchChange,
  onAdd,
  onToggle,
  onEdit,
  onDelete,
  onSchedule,
  onTogglePriority,
  onSetReminder,
}: Props) {
  const [draft, setDraft] = useState("");
  const [showDone, setShowDone] = useState(false);

  const pending = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setDraft("");
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Список дел
      </h2>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <form onSubmit={submit}>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Что сделать?"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </form>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M11 11l3 3" />
            </svg>
          </span>
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Поиск /"
            className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-9 pr-3 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
          {search && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Сбросить поиск"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {pending.length === 0 && done.length === 0 ? (
        <p className="py-3 text-sm text-zinc-400 dark:text-zinc-600">
          Пусто. Добавь дело — оно появится здесь.
        </p>
      ) : (
        <div className="max-h-[28rem] overflow-y-auto pr-1">
          {pending.length > 0 && (
            <ul className="space-y-1">
              {pending.map((t) => (
                <Row
                  key={t.id}
                  task={t}
                  reminderDefaults={reminderDefaults}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onSchedule={onSchedule}
                  onTogglePriority={onTogglePriority}
                  onSetReminder={onSetReminder}
                />
              ))}
            </ul>
          )}

          {done.length > 0 && (
            <div className={pending.length > 0 ? "mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800" : ""}>
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
                <ul className="mt-1 space-y-1">
                  {done.map((t) => (
                    <Row
                      key={t.id}
                      task={t}
                      reminderDefaults={reminderDefaults}
                      onToggle={onToggle}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onSchedule={onSchedule}
                      onTogglePriority={onTogglePriority}
                      onSetReminder={onSetReminder}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({
  task,
  reminderDefaults,
  onToggle,
  onEdit,
  onDelete,
  onSchedule,
  onTogglePriority,
  onSetReminder,
}: {
  task: Task;
  reminderDefaults: { mode: ReminderMode; time: string };
  onToggle: (id: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
  onSchedule: (id: string, dueDate: string) => void;
  onTogglePriority: (id: string) => void;
  onSetReminder: (id: string, reminder: Reminder | undefined) => void;
}) {
  const done = task.status === "done";

  return (
    <li className="group flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 transition hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900">
      <button
        type="button"
        onClick={() => onToggle(task.id)}
        aria-label={done ? "Отметить невыполненной" : "Отметить выполненной"}
        className={[
          "flex h-5 w-5 flex-none items-center justify-center rounded-md border transition",
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
        onClick={() => onEdit(task)}
        className="flex-1 min-w-0 text-left"
        aria-label={`Открыть задачу: ${task.title}`}
      >
        <span
          className={[
            "block truncate text-sm",
            done
              ? "text-zinc-400 line-through dark:text-zinc-600"
              : "text-zinc-900 dark:text-zinc-100",
          ].join(" ")}
        >
          {task.title}
        </span>
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {task.dueDate && (
            <span
              className={[
                "inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium dark:bg-zinc-800",
                done
                  ? "text-zinc-400 dark:text-zinc-600"
                  : "text-zinc-600 dark:text-zinc-300",
              ].join(" ")}
            >
              <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="12" height="11" rx="1.5" />
                <path d="M2 6h12M5.5 1.5v3M10.5 1.5v3" />
              </svg>
              {formatHumanDate(task.dueDate)}
              {task.dueTime && (
                <span className="font-mono tabular-nums">
                  {" · "}
                  {task.dueTime}
                  {task.endTime ? `–${task.endTime}` : ""}
                </span>
              )}
            </span>
          )}
          {task.description && (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              💬
            </span>
          )}
          {task.recurringId && (
            <span
              className="text-[10px] text-zinc-400 dark:text-zinc-500"
              title="Часть повторяющейся серии"
            >
              🔁
            </span>
          )}
          {task.tags.map((tag) => (
            <TagPill key={tag} tag={tag} muted={done} />
          ))}
          {task.subtasks && task.subtasks.length > 0 && (
            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
              ✓ {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
            </span>
          )}
        </div>
      </button>

      <PriorityFlag
        isHigh={task.priority === "high"}
        onToggle={() => onTogglePriority(task.id)}
      />
      <ReminderButton
        reminder={task.reminder}
        defaults={reminderDefaults}
        onChange={(r) => onSetReminder(task.id, r)}
        disabled={!task.dueDate}
      />
      <SnoozeMenu onPick={(iso) => onSchedule(task.id, iso)} />

      <button
        type="button"
        onClick={() => onDelete(task.id)}
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
