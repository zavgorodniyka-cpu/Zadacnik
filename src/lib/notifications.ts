"use client";

import type { ReminderMode, Task } from "@/types/task";
import type { Anniversary } from "@/types/anniversary";
import { nextOccurrence } from "./anniversaries";
import { toISODate } from "./dates";

export type NotificationSettings = {
  enabled: boolean;
};

const SETTINGS_KEY = "planner.notify.v4";

const DEFAULTS: NotificationSettings = {
  enabled: true,
};

export const REMINDER_DEFAULTS: { mode: ReminderMode; time: string } = {
  mode: "same_day",
  time: "09:00",
};

export function loadSettings(): NotificationSettings {
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return { enabled: !!parsed.enabled };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: NotificationSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

export function isSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function currentPermission(): NotificationPermission {
  if (!isSupported()) return "denied";
  return Notification.permission;
}

export async function requestPermission(): Promise<NotificationPermission> {
  if (!isSupported()) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return await Notification.requestPermission();
}

function buildReminderTime(
  dueDateISO: string,
  mode: ReminderMode,
  reminderTime: string,
): number {
  const [y, m, d] = dueDateISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (mode === "day_before") {
    date.setDate(date.getDate() - 1);
  }
  const [hh, mm] = reminderTime.split(":").map(Number);
  date.setHours(hh, mm, 0, 0);
  return date.getTime();
}

export function scheduleNotifications(
  tasks: Task[],
  anniversaries: Anniversary[],
  settings: NotificationSettings,
): () => void {
  if (
    !settings.enabled ||
    !isSupported() ||
    Notification.permission !== "granted"
  ) {
    return () => {};
  }

  const timers: ReturnType<typeof setTimeout>[] = [];
  const now = Date.now();
  const horizonMs = 25 * 60 * 60 * 1000;

  for (const t of tasks) {
    if (t.status === "done" || !t.dueDate || !t.reminder) continue;
    const fireAt = buildReminderTime(
      t.dueDate,
      t.reminder.mode,
      t.reminder.time,
    );
    const delay = fireAt - now;
    if (delay <= 0 || delay > horizonMs) continue;

    const reminder = t.reminder;
    const title = t.title;
    const dueTime = t.dueTime;
    const endTime = t.endTime;
    const id = t.id;

    const timer = setTimeout(() => {
      try {
        const whenLabel = reminder.mode === "day_before" ? "Завтра" : "Сегодня";
        const timeLabel = dueTime
          ? ` в ${dueTime}${endTime ? `–${endTime}` : ""}`
          : "";
        new Notification(title, {
          body: `${whenLabel}${timeLabel}`,
          tag: `task-${id}`,
        });
      } catch {
        // ignore
      }
    }, delay);
    timers.push(timer);
  }

  for (const a of anniversaries) {
    if (!a.notify) continue;
    const next = nextOccurrence(a, new Date());
    if (!next) continue;
    const fireAt = buildReminderTime(toISODate(next), a.notify.mode, a.notify.time);
    const delay = fireAt - now;
    if (delay <= 0 || delay > horizonMs) continue;

    const notify = a.notify;
    const title = `${a.emoji ? a.emoji + " " : ""}${a.title}`;
    const id = a.id;

    const timer = setTimeout(() => {
      try {
        const whenLabel = notify.mode === "day_before" ? "Завтра" : "Сегодня";
        new Notification(title, {
          body: whenLabel,
          tag: `anniversary-${id}`,
        });
      } catch {
        // ignore
      }
    }, delay);
    timers.push(timer);
  }

  return () => timers.forEach((t) => clearTimeout(t));
}
