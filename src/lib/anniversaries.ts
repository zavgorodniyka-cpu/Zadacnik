"use client";

import type { Anniversary, Recurrence } from "@/types/anniversary";
import { fromISODate, toISODate } from "./dates";

const STORAGE_KEY = "planner.anniversaries.v1";

export function loadAnniversaries(): Anniversary[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Anniversary[]) : [];
  } catch {
    return [];
  }
}

export function saveAnniversaries(items: Anniversary[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function step(date: Date, recurrence: Recurrence): void {
  switch (recurrence) {
    case "daily":
      date.setDate(date.getDate() + 1);
      break;
    case "weekly":
      date.setDate(date.getDate() + 7);
      break;
    case "monthly":
      date.setMonth(date.getMonth() + 1);
      break;
    case "yearly":
      date.setFullYear(date.getFullYear() + 1);
      break;
    case "none":
      break;
  }
}

export function nextOccurrence(
  a: Anniversary,
  fromDate: Date = new Date(),
): Date | null {
  const start = fromISODate(a.startDate);
  const today = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  );

  if (a.recurrence === "none") {
    return start >= today ? start : null;
  }

  const next = new Date(start);
  let safety = 0;
  while (next < today) {
    step(next, a.recurrence);
    if (++safety > 5000) return null;
  }
  return next;
}

export function getOccurrencesInRange(
  anniversaries: Anniversary[],
  rangeStart: Date,
  rangeEnd: Date,
): Map<string, Anniversary[]> {
  const map = new Map<string, Anniversary[]>();
  const startMs = rangeStart.getTime();
  const endMs = rangeEnd.getTime();

  for (const a of anniversaries) {
    const start = fromISODate(a.startDate);

    if (a.recurrence === "none") {
      const ms = start.getTime();
      if (ms >= startMs && ms <= endMs) {
        const iso = toISODate(start);
        const arr = map.get(iso) ?? [];
        arr.push(a);
        map.set(iso, arr);
      }
      continue;
    }

    const cursor = new Date(start);
    let safety = 0;
    while (cursor < rangeStart) {
      step(cursor, a.recurrence);
      if (++safety > 5000) break;
    }
    while (cursor <= rangeEnd) {
      const iso = toISODate(cursor);
      const arr = map.get(iso) ?? [];
      arr.push(a);
      map.set(iso, arr);
      step(cursor, a.recurrence);
      if (++safety > 10000) break;
    }
  }

  return map;
}

export function recurrenceLabel(r: Recurrence): string {
  switch (r) {
    case "yearly":
      return "ежегодно";
    case "monthly":
      return "ежемесячно";
    case "weekly":
      return "еженедельно";
    case "daily":
      return "ежедневно";
    case "none":
      return "разово";
  }
}
