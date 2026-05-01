"use client";

import type { Task } from "@/types/task";
import { getSupabase } from "@/lib/supabase";

type DbTask = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "high" | null;
  due_date: string | null;
  due_time: string | null;
  end_time: string | null;
  reminder: { mode: "day_before" | "same_day"; time: string } | null;
  tags: string[];
  subtasks: Array<{ id: string; title: string; done: boolean }> | null;
  source: string;
  external_id: string | null;
  recurring_id: string | null;
  created_at: string;
};

function fromDb(row: DbTask): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    priority: row.priority ?? undefined,
    dueDate: row.due_date ?? undefined,
    dueTime: row.due_time ?? undefined,
    endTime: row.end_time ?? undefined,
    reminder: row.reminder ?? undefined,
    tags: row.tags ?? [],
    subtasks: row.subtasks ?? undefined,
    source: row.source as Task["source"],
    externalId: row.external_id ?? undefined,
    recurringId: row.recurring_id ?? undefined,
    createdAt: row.created_at,
  };
}

function toDbInsert(task: Task): Omit<DbTask, "user_id"> {
  return {
    id: task.id,
    title: task.title,
    description: task.description ?? null,
    status: task.status,
    priority: task.priority ?? null,
    due_date: task.dueDate ?? null,
    due_time: task.dueTime ?? null,
    end_time: task.endTime ?? null,
    reminder: task.reminder ?? null,
    tags: task.tags,
    subtasks: task.subtasks ?? null,
    source: task.source,
    external_id: task.externalId ?? null,
    recurring_id: task.recurringId ?? null,
    created_at: task.createdAt,
  };
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await getSupabase()
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbTask[]).map(fromDb);
}

export async function insertTask(task: Task): Promise<void> {
  const { error } = await getSupabase().from("tasks").insert(toDbInsert(task));
  if (error) throw error;
}

export async function bulkInsertTasks(tasks: Task[]): Promise<void> {
  if (tasks.length === 0) return;
  const { error } = await getSupabase()
    .from("tasks")
    .insert(tasks.map(toDbInsert));
  if (error) throw error;
}

export async function updateTask(id: string, patch: Partial<Task>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.description !== undefined) dbPatch.description = patch.description ?? null;
  if (patch.status !== undefined) dbPatch.status = patch.status;
  if (patch.priority !== undefined) dbPatch.priority = patch.priority ?? null;
  if (patch.dueDate !== undefined) dbPatch.due_date = patch.dueDate ?? null;
  if (patch.dueTime !== undefined) dbPatch.due_time = patch.dueTime ?? null;
  if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime ?? null;
  if (patch.reminder !== undefined) dbPatch.reminder = patch.reminder ?? null;
  if (patch.tags !== undefined) dbPatch.tags = patch.tags;
  if (patch.subtasks !== undefined) dbPatch.subtasks = patch.subtasks ?? null;

  const { error } = await getSupabase().from("tasks").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await getSupabase().from("tasks").delete().eq("id", id);
  if (error) throw error;
}
