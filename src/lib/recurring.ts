import type { Reminder, Subtask, Task } from "@/types/task";
import { toISODate } from "./dates";
import { generateId } from "./storage";

export type RecurrenceKind = "none" | "daily" | "weekdays" | "weekly" | "monthly";

export type Recurrence = {
  kind: RecurrenceKind;
  weekdays?: number[]; // 0=Sun..6=Sat, used when kind="weekly"
};

export const WEEKDAY_LABELS_RU = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];

const HORIZON_WEEKS = 12;
const HORIZON_MONTHS = 6;

type BaseTaskFields = {
  title: string;
  description?: string;
  dueTime?: string;
  endTime?: string;
  priority?: "high";
  tags: string[];
  subtasks?: Subtask[];
  reminder?: Reminder;
};

export function generateRecurrenceInstances(
  startDateIso: string,
  recurrence: Recurrence,
  base: BaseTaskFields,
): Task[] {
  if (recurrence.kind === "none") return [];
  const recurringId = generateId();
  const createdAt = new Date().toISOString();
  const [y, m, d] = startDateIso.split("-").map(Number);
  const start = new Date(y, m - 1, d);
  const out: Task[] = [];

  function pushOn(date: Date) {
    out.push({
      id: generateId(),
      title: base.title,
      description: base.description,
      status: "todo",
      priority: base.priority,
      dueDate: toISODate(date),
      dueTime: base.dueTime,
      endTime: base.endTime,
      reminder: base.reminder,
      tags: [...base.tags],
      subtasks: base.subtasks,
      source: "internal",
      recurringId,
      createdAt,
    });
  }

  if (recurrence.kind === "monthly") {
    for (let i = 0; i < HORIZON_MONTHS; i++) {
      const cand = new Date(start.getFullYear(), start.getMonth() + i, start.getDate());
      // Skip if rolled over (e.g. Jan 31 + 1 month → Mar 3 in JS)
      if (cand.getDate() !== start.getDate()) continue;
      pushOn(cand);
    }
    return out;
  }

  let targetDays: number[];
  if (recurrence.kind === "daily") targetDays = [0, 1, 2, 3, 4, 5, 6];
  else if (recurrence.kind === "weekdays") targetDays = [1, 2, 3, 4, 5];
  else targetDays = recurrence.weekdays ?? [];

  if (targetDays.length === 0) return [];

  for (let i = 0; i < HORIZON_WEEKS * 7; i++) {
    const cand = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (!targetDays.includes(cand.getDay())) continue;
    pushOn(cand);
  }
  return out;
}

type RecurringTemplate = {
  recurringId: string;
  title: string;
  weekdays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
  dueTime: string;
  endTime: string;
  tags: string[];
};

const TEMPLATES: RecurringTemplate[] = [
  {
    recurringId: "english-class",
    title: "Урок английского",
    weekdays: [2, 4], // Tue, Thu
    dueTime: "12:00",
    endTime: "13:00",
    tags: ["английский"],
  },
  {
    recurringId: "padel",
    title: "Падел",
    weekdays: [4], // Thu
    dueTime: "09:00",
    endTime: "10:00",
    tags: ["спорт"],
  },
];

export function generateRecurringTasks(start: Date, weeks: number): Task[] {
  const out: Task[] = [];
  const createdAt = new Date().toISOString();

  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const dow = d.getDay();
    const iso = toISODate(d);

    for (const tpl of TEMPLATES) {
      if (!tpl.weekdays.includes(dow)) continue;
      out.push({
        id: generateId(),
        title: tpl.title,
        status: "todo",
        dueDate: iso,
        dueTime: tpl.dueTime,
        endTime: tpl.endTime,
        tags: [...tpl.tags],
        source: "internal",
        recurringId: tpl.recurringId,
        createdAt,
      });
    }
  }

  return out;
}
