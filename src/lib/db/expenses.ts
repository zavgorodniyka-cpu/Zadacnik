"use client";

import type { Expense, ExpenseBucket } from "@/types/expense";
import { getSupabase } from "@/lib/supabase";

type DbExpense = {
  id: string;
  user_id: string;
  date: string;
  bucket: string | null;
  category: string;
  subcategory: string | null;
  description: string | null;
  amount: number | string;
  created_at: string;
};

function normalizeBucket(raw: string | null | undefined): ExpenseBucket {
  return raw === "other" ? "other" : "home";
}

function fromDb(row: DbExpense): Expense {
  return {
    id: row.id,
    date: row.date,
    bucket: normalizeBucket(row.bucket),
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    description: row.description ?? undefined,
    amount: typeof row.amount === "string" ? parseFloat(row.amount) : row.amount,
    createdAt: row.created_at,
  };
}

function toDbInsert(e: Expense): Omit<DbExpense, "user_id"> {
  return {
    id: e.id,
    date: e.date,
    bucket: e.bucket,
    category: e.category,
    subcategory: e.subcategory ?? null,
    description: e.description ?? null,
    amount: e.amount,
    created_at: e.createdAt,
  };
}

export async function fetchExpenses(): Promise<Expense[]> {
  const { data, error } = await getSupabase()
    .from("expenses")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbExpense[]).map(fromDb);
}

export async function insertExpense(e: Expense): Promise<void> {
  const { error } = await getSupabase().from("expenses").insert(toDbInsert(e));
  if (error) throw error;
}

export async function bulkInsertExpenses(items: Expense[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await getSupabase()
    .from("expenses")
    .insert(items.map(toDbInsert));
  if (error) throw error;
}

export async function updateExpense(
  id: string,
  patch: Partial<Expense>,
): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.date !== undefined) dbPatch.date = patch.date;
  if (patch.bucket !== undefined) dbPatch.bucket = patch.bucket;
  if (patch.category !== undefined) dbPatch.category = patch.category;
  if (patch.subcategory !== undefined) dbPatch.subcategory = patch.subcategory ?? null;
  if (patch.description !== undefined) dbPatch.description = patch.description ?? null;
  if (patch.amount !== undefined) dbPatch.amount = patch.amount;
  const { error } = await getSupabase().from("expenses").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await getSupabase().from("expenses").delete().eq("id", id);
  if (error) throw error;
}
