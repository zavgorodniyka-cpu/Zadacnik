export type TaskStatus = "todo" | "in_progress" | "done";

export type TaskSource = "internal" | "telegram" | "todoist" | "notion";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
};

export type ReminderMode = "day_before" | "same_day";

export type Reminder = {
  mode: ReminderMode;
  time: string; // "HH:MM"
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority?: "high";
  dueDate?: string;
  dueTime?: string;
  endTime?: string;
  reminder?: Reminder;
  tags: string[];
  subtasks?: Subtask[];
  source: TaskSource;
  externalId?: string;
  recurringId?: string;
  createdAt: string;
  syncedAt?: string;
};

export type NewTask = Omit<Task, "id" | "createdAt" | "status" | "source" | "tags"> & {
  status?: TaskStatus;
  source?: TaskSource;
  tags?: string[];
};
