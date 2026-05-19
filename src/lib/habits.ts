import type { Habit, HabitCheckin, HabitSchedule } from "@/types/habit";
import { fromISODate, toISODate, todayISO } from "@/lib/dates";

// JS Date.getDay(): 0=Sun..6=Sat. We treat 1=Mon..7=Sun in UI labels,
// but here keep raw JS numbers in the data.

export function isScheduledOn(schedule: HabitSchedule, date: Date): boolean {
  if (schedule.kind === "daily") return true;
  return schedule.days.includes(date.getDay());
}

export function isScheduledOnISO(schedule: HabitSchedule, iso: string): boolean {
  return isScheduledOn(schedule, fromISODate(iso));
}

export function scheduleLabel(schedule: HabitSchedule): string {
  if (schedule.kind === "daily") return "каждый день";
  if (schedule.days.length === 0) return "—";
  if (schedule.days.length === 7) return "каждый день";
  const isWeekdays =
    schedule.days.length === 5 &&
    [1, 2, 3, 4, 5].every((d) => schedule.days.includes(d));
  if (isWeekdays) return "по будням";
  const isWeekends =
    schedule.days.length === 2 &&
    schedule.days.includes(0) &&
    schedule.days.includes(6);
  if (isWeekends) return "по выходным";
  // Order: Mon..Sun for display
  const order = [1, 2, 3, 4, 5, 6, 0];
  const labels = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
  const names = order
    .filter((d) => schedule.days.includes(d))
    .map((d) => labels[d]);
  return names.join(", ");
}

function makeCheckinKey(habitId: string, date: string): string {
  return `${habitId}|${date}`;
}

export function buildCheckinIndex(checkins: HabitCheckin[]): Set<string> {
  const idx = new Set<string>();
  for (const c of checkins) idx.add(makeCheckinKey(c.habitId, c.date));
  return idx;
}

export function isDoneOn(
  index: Set<string>,
  habitId: string,
  iso: string,
): boolean {
  return index.has(makeCheckinKey(habitId, iso));
}

/**
 * Current streak — consecutive scheduled days ending today (or yesterday)
 * where the habit was done. Counts back from today; if today is scheduled
 * but not yet done, we still allow streak to continue from the last
 * scheduled day before today.
 */
export function calcStreak(
  habit: Habit,
  index: Set<string>,
  today: Date = new Date(),
): number {
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayIso = toISODate(cursor);
  const todayScheduled = isScheduledOn(habit.schedule, cursor);
  const todayDone = isDoneOn(index, habit.id, todayIso);
  if (todayScheduled && !todayDone) {
    cursor.setDate(cursor.getDate() - 1);
  }
  // walk backwards across scheduled days
  for (let i = 0; i < 365; i++) {
    if (!isScheduledOn(habit.schedule, cursor)) {
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    const iso = toISODate(cursor);
    if (isDoneOn(index, habit.id, iso)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

export function calcLast30(
  habit: Habit,
  index: Set<string>,
  today: Date = new Date(),
): { scheduled: number; done: number; days: { iso: string; scheduled: boolean; done: boolean }[] } {
  const days: { iso: string; scheduled: boolean; done: boolean }[] = [];
  let scheduled = 0;
  let done = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cursor.setDate(cursor.getDate() - 29);
  for (let i = 0; i < 30; i++) {
    const iso = toISODate(cursor);
    const isScheduled = isScheduledOn(habit.schedule, cursor);
    const isDone = isDoneOn(index, habit.id, iso);
    days.push({ iso, scheduled: isScheduled, done: isDone });
    if (isScheduled) scheduled += 1;
    if (isScheduled && isDone) done += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return { scheduled, done, days };
}

export function calcBestStreak(
  habit: Habit,
  index: Set<string>,
  today: Date = new Date(),
): number {
  // Scan last 365 days; for an MVP this is enough.
  let best = 0;
  let current = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  cursor.setDate(cursor.getDate() - 364);
  for (let i = 0; i < 365; i++) {
    if (isScheduledOn(habit.schedule, cursor)) {
      const iso = toISODate(cursor);
      if (isDoneOn(index, habit.id, iso)) {
        current += 1;
        if (current > best) best = current;
      } else {
        current = 0;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return best;
}

export function todayHabits(habits: Habit[]): Habit[] {
  const today = new Date();
  return habits.filter((h) => isScheduledOn(h.schedule, today));
}

export function todayIsoLocal(): string {
  return todayISO();
}
