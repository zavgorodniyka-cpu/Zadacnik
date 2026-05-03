"use client";

import type { Task } from "@/types/task";
import type { Anniversary } from "@/types/anniversary";
import type { Folder, IdeaItem } from "@/types/folder";
import type { Expense } from "@/types/expense";
import {
  bulkInsertTasks,
  deleteTask as dbDeleteTask,
  insertTask as dbInsertTask,
  updateTask as dbUpdateTask,
} from "@/lib/db/tasks";
import {
  bulkInsertAnniversaries,
  deleteAnniversary as dbDeleteAnniversary,
  insertAnniversary as dbInsertAnniversary,
  updateAnniversary as dbUpdateAnniversary,
} from "@/lib/db/anniversaries";
import {
  bulkInsertFolders,
  bulkInsertIdeas,
  deleteFolder as dbDeleteFolder,
  deleteIdea as dbDeleteIdea,
  insertFolder as dbInsertFolder,
  insertIdea as dbInsertIdea,
  updateFolder as dbUpdateFolder,
  updateIdea as dbUpdateIdea,
} from "@/lib/db/folders";
import {
  bulkInsertExpenses,
  deleteExpense as dbDeleteExpense,
  insertExpense as dbInsertExpense,
  updateExpense as dbUpdateExpense,
} from "@/lib/db/expenses";

const CACHE_KEY = "planner.offline-cache.v1";
const QUEUE_KEY = "planner.sync-queue.v1";

export type OfflineCache = {
  tasks: Task[];
  anniversaries: Anniversary[];
  folders: Folder[];
  ideas: IdeaItem[];
  expenses: Expense[];
  savedAt: string;
};

export function loadOfflineCache(): OfflineCache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineCache;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOfflineCache(cache: Omit<OfflineCache, "savedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...cache, savedAt: new Date().toISOString() }),
    );
  } catch {
    // localStorage might be full — ignore.
  }
}

// ---------- Sync queue ----------

export type QueueEntry =
  | { kind: "task.insert"; task: Task }
  | { kind: "task.bulk-insert"; tasks: Task[] }
  | { kind: "task.update"; id: string; patch: Partial<Task> }
  | { kind: "task.delete"; id: string }
  | { kind: "anniversary.insert"; anniversary: Anniversary }
  | { kind: "anniversary.bulk-insert"; anniversaries: Anniversary[] }
  | { kind: "anniversary.update"; id: string; patch: Partial<Anniversary> }
  | { kind: "anniversary.delete"; id: string }
  | { kind: "folder.insert"; folder: Folder }
  | { kind: "folder.bulk-insert"; folders: Folder[] }
  | { kind: "folder.update"; id: string; patch: Partial<Folder> }
  | { kind: "folder.delete"; id: string }
  | { kind: "idea.insert"; idea: IdeaItem }
  | { kind: "idea.bulk-insert"; ideas: IdeaItem[] }
  | { kind: "idea.update"; id: string; patch: Partial<IdeaItem> }
  | { kind: "idea.delete"; id: string }
  | { kind: "expense.insert"; expense: Expense }
  | { kind: "expense.bulk-insert"; expenses: Expense[] }
  | { kind: "expense.update"; id: string; patch: Partial<Expense> }
  | { kind: "expense.delete"; id: string };

function loadQueue(): QueueEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueueEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function getQueueLength(): number {
  return loadQueue().length;
}

export function enqueueMutation(entry: QueueEntry): void {
  const queue = loadQueue();
  queue.push(entry);
  saveQueue(queue);
}

async function applyEntry(entry: QueueEntry): Promise<void> {
  switch (entry.kind) {
    case "task.insert":
      return dbInsertTask(entry.task);
    case "task.bulk-insert":
      return bulkInsertTasks(entry.tasks);
    case "task.update":
      return dbUpdateTask(entry.id, entry.patch);
    case "task.delete":
      return dbDeleteTask(entry.id);
    case "anniversary.insert":
      return dbInsertAnniversary(entry.anniversary);
    case "anniversary.bulk-insert":
      return bulkInsertAnniversaries(entry.anniversaries);
    case "anniversary.update":
      return dbUpdateAnniversary(entry.id, entry.patch);
    case "anniversary.delete":
      return dbDeleteAnniversary(entry.id);
    case "folder.insert":
      return dbInsertFolder(entry.folder);
    case "folder.bulk-insert":
      return bulkInsertFolders(entry.folders);
    case "folder.update":
      return dbUpdateFolder(entry.id, entry.patch);
    case "folder.delete":
      return dbDeleteFolder(entry.id);
    case "idea.insert":
      return dbInsertIdea(entry.idea);
    case "idea.bulk-insert":
      return bulkInsertIdeas(entry.ideas);
    case "idea.update":
      return dbUpdateIdea(entry.id, entry.patch);
    case "idea.delete":
      return dbDeleteIdea(entry.id);
    case "expense.insert":
      return dbInsertExpense(entry.expense);
    case "expense.bulk-insert":
      return bulkInsertExpenses(entry.expenses);
    case "expense.update":
      return dbUpdateExpense(entry.id, entry.patch);
    case "expense.delete":
      return dbDeleteExpense(entry.id);
  }
}

let isDraining = false;

export async function drainQueue(
  onChange?: (remaining: number) => void,
): Promise<{ remaining: number; succeeded: number; failed: number }> {
  if (isDraining) return { remaining: getQueueLength(), succeeded: 0, failed: 0 };
  isDraining = true;
  let succeeded = 0;
  let failed = 0;
  try {
    let queue = loadQueue();
    onChange?.(queue.length);
    while (queue.length > 0) {
      const entry = queue[0];
      try {
        await applyEntry(entry);
        queue = queue.slice(1);
        saveQueue(queue);
        succeeded += 1;
        onChange?.(queue.length);
      } catch {
        // Stop draining on first failure — likely still offline or server down.
        failed += 1;
        break;
      }
    }
    return { remaining: queue.length, succeeded, failed };
  } finally {
    isDraining = false;
  }
}

// ---------- Convenience wrapper ----------

/**
 * Try a database mutation; on failure, push it to the offline queue so it
 * eventually syncs when connectivity is restored. Resolves once the local
 * decision is made (either DB success or enqueue).
 */
export async function trySync(
  attempt: () => Promise<void>,
  fallbackEntry: QueueEntry,
): Promise<void> {
  try {
    await attempt();
  } catch (err) {
    enqueueMutation(fallbackEntry);
    if (typeof console !== "undefined") {
      console.warn("[planner offline] queued mutation:", fallbackEntry.kind, err);
    }
  }
}
