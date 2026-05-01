"use client";

import type { Anniversary, Recurrence } from "@/types/anniversary";
import { getSupabase } from "@/lib/supabase";

type DbAnniversary = {
  id: string;
  user_id: string;
  title: string;
  emoji: string | null;
  start_date: string;
  recurrence: Recurrence;
  notify: { mode: "day_before" | "same_day"; time: string } | null;
  notes: string | null;
  created_at: string;
};

function fromDb(row: DbAnniversary): Anniversary {
  return {
    id: row.id,
    title: row.title,
    emoji: row.emoji ?? undefined,
    startDate: row.start_date,
    recurrence: row.recurrence,
    notify: row.notify ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function toDbInsert(a: Anniversary): Omit<DbAnniversary, "user_id"> {
  return {
    id: a.id,
    title: a.title,
    emoji: a.emoji ?? null,
    start_date: a.startDate,
    recurrence: a.recurrence,
    notify: a.notify ?? null,
    notes: a.notes ?? null,
    created_at: a.createdAt,
  };
}

export async function fetchAnniversaries(): Promise<Anniversary[]> {
  const { data, error } = await getSupabase()
    .from("anniversaries")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbAnniversary[]).map(fromDb);
}

export async function insertAnniversary(a: Anniversary): Promise<void> {
  const { error } = await getSupabase().from("anniversaries").insert(toDbInsert(a));
  if (error) throw error;
}

export async function bulkInsertAnniversaries(items: Anniversary[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await getSupabase()
    .from("anniversaries")
    .insert(items.map(toDbInsert));
  if (error) throw error;
}

export async function updateAnniversary(
  id: string,
  patch: Partial<Anniversary>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.emoji !== undefined) dbPatch.emoji = patch.emoji ?? null;
  if (patch.startDate !== undefined) dbPatch.start_date = patch.startDate;
  if (patch.recurrence !== undefined) dbPatch.recurrence = patch.recurrence;
  if (patch.notify !== undefined) dbPatch.notify = patch.notify ?? null;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null;
  const { error } = await getSupabase()
    .from("anniversaries")
    .update(dbPatch)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteAnniversary(id: string): Promise<void> {
  const { error } = await getSupabase().from("anniversaries").delete().eq("id", id);
  if (error) throw error;
}
