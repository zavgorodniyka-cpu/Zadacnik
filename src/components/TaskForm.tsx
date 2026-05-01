"use client";

import { useEffect, useState } from "react";
import type { Reminder, ReminderMode, Subtask, Task } from "@/types/task";
import SubtaskEditor from "./SubtaskEditor";

type Props = {
  defaultDate: string;
  defaultTime?: string;
  editingTask: Task | null;
  reminderDefaults: { mode: ReminderMode; time: string };
  onSubmit: (data: {
    title: string;
    description: string;
    dueDate: string;
    dueTime: string;
    endTime: string;
    priority: "high" | undefined;
    tags: string[];
    subtasks: Subtask[];
    reminder: Reminder | undefined;
  }) => void;
  onClose: () => void;
};

function parseTagsInput(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export default function TaskForm({ defaultDate, defaultTime, editingTask, reminderDefaults, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState(defaultDate);
  const [dueTime, setDueTime] = useState(defaultTime ?? "");
  const [endTime, setEndTime] = useState("");
  const [isHigh, setIsHigh] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [reminder, setReminder] = useState<Reminder | undefined>(undefined);

  const isEditing = !!editingTask;

  useEffect(() => {
    if (editingTask) {
      setTitle(editingTask.title);
      setDescription(editingTask.description ?? "");
      setDueDate(editingTask.dueDate ?? defaultDate);
      setDueTime(editingTask.dueTime ?? "");
      setEndTime(editingTask.endTime ?? "");
      setIsHigh(editingTask.priority === "high");
      setTagsInput(editingTask.tags.join(", "));
      setSubtasks(editingTask.subtasks ?? []);
      setReminder(editingTask.reminder);
    } else {
      setTitle("");
      setDescription("");
      setDueDate(defaultDate);
      setDueTime(defaultTime ?? "");
      setEndTime("");
      setIsHigh(false);
      setTagsInput("");
      setSubtasks([]);
      setReminder(undefined);
    }
  }, [editingTask, defaultDate, defaultTime]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({
      title: trimmed,
      description: description.trim(),
      dueDate,
      dueTime,
      endTime,
      priority: isHigh ? "high" : undefined,
      tags: parseTagsInput(tagsInput),
      subtasks,
      reminder,
    });
    onClose();
  }

  function setReminderMode(mode: ReminderMode) {
    setReminder({ mode, time: reminder?.time ?? reminderDefaults.time });
  }
  function setReminderTime(time: string) {
    setReminder({ mode: reminder?.mode ?? reminderDefaults.mode, time });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {isEditing ? "Редактировать задачу" : "Новая задача"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
          className="rounded-md p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Название
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Например: встреча с командой"
            autoFocus
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Дата
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Время с
            </label>
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              до
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Метки <span className="text-zinc-400">(через запятую)</span>
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="напр.: работа, важное"
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Заметка
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Детали, ссылки, контекст…"
            rows={2}
            className="w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </div>

        <SubtaskEditor subtasks={subtasks} onChange={setSubtasks} />

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Напоминание
            </label>
            {reminder && (
              <button
                type="button"
                onClick={() => setReminder(undefined)}
                className="text-[11px] text-red-600 transition hover:underline dark:text-red-400"
              >
                убрать
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setReminder(undefined)}
                className={[
                  "rounded-md px-2 py-1.5 text-xs font-medium transition",
                  !reminder
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                Без
              </button>
              <button
                type="button"
                onClick={() => setReminderMode("day_before")}
                className={[
                  "rounded-md px-2 py-1.5 text-xs font-medium transition",
                  reminder?.mode === "day_before"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                За день
              </button>
              <button
                type="button"
                onClick={() => setReminderMode("same_day")}
                className={[
                  "rounded-md px-2 py-1.5 text-xs font-medium transition",
                  reminder?.mode === "same_day"
                    ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                ].join(" ")}
              >
                В день
              </button>
            </div>
            <input
              type="time"
              value={reminder?.time ?? reminderDefaults.time}
              disabled={!reminder}
              onChange={(e) => setReminderTime(e.target.value)}
              className="w-28 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="submit"
          disabled={!title.trim()}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {isEditing ? "Сохранить" : "Добавить"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => setIsHigh((v) => !v)}
          aria-pressed={isHigh}
          className={[
            "ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition",
            isHigh
              ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-950/50 dark:text-red-200 dark:hover:bg-red-950"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
          ].join(" ")}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill={isHigh ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v12M3 3h8l-1.5 3L11 9H3" />
          </svg>
          Важная
        </button>
      </div>
    </form>
  );
}
