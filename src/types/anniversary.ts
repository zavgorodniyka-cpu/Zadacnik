import type { ReminderMode } from "./task";

export type Recurrence = "yearly" | "monthly" | "weekly" | "daily" | "none";

export type AnniversaryNotify = {
  mode: ReminderMode;
  time: string; // "HH:MM"
};

export type Anniversary = {
  id: string;
  title: string;
  emoji?: string;
  startDate: string; // YYYY-MM-DD — first/anchor date
  recurrence: Recurrence;
  notify?: AnniversaryNotify;
  notes?: string;
  createdAt: string;
};
