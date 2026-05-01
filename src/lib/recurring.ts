import type { Task } from "@/types/task";
import { toISODate } from "./dates";
import { generateId } from "./storage";

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
