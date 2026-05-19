"use client";

import type { Habit, HabitCheckin, HabitSchedule } from "@/types/habit";
import { getSupabase } from "@/lib/supabase";

type DbHabit = {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  schedule: HabitSchedule;
  created_at: string;
};

type DbCheckin = {
  id: string;
  user_id: string;
  habit_id: string;
  date: string;
  created_at: string;
};

function fromDbHabit(row: DbHabit): Habit {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? undefined,
    schedule: row.schedule ?? { kind: "daily" },
    createdAt: row.created_at,
  };
}

function toDbHabit(h: Habit): Omit<DbHabit, "user_id"> {
  return {
    id: h.id,
    name: h.name,
    emoji: h.emoji ?? null,
    schedule: h.schedule,
    created_at: h.createdAt,
  };
}

function fromDbCheckin(row: DbCheckin): HabitCheckin {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    createdAt: row.created_at,
  };
}

export async function fetchHabits(): Promise<Habit[]> {
  const { data, error } = await getSupabase()
    .from("habits")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbHabit[]).map(fromDbHabit);
}

export async function fetchHabitCheckins(): Promise<HabitCheckin[]> {
  const { data, error } = await getSupabase()
    .from("habit_checkins")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbCheckin[]).map(fromDbCheckin);
}

export async function insertHabit(habit: Habit): Promise<void> {
  const { error } = await getSupabase().from("habits").insert(toDbHabit(habit));
  if (error) throw error;
}

export async function updateHabit(id: string, patch: Partial<Habit>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.emoji !== undefined) dbPatch.emoji = patch.emoji ?? null;
  if (patch.schedule !== undefined) dbPatch.schedule = patch.schedule;
  if (Object.keys(dbPatch).length === 0) return;
  const { error } = await getSupabase().from("habits").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteHabit(id: string): Promise<void> {
  const { error } = await getSupabase().from("habits").delete().eq("id", id);
  if (error) throw error;
}

export async function insertCheckin(checkin: HabitCheckin): Promise<void> {
  const { error } = await getSupabase().from("habit_checkins").insert({
    id: checkin.id,
    habit_id: checkin.habitId,
    date: checkin.date,
    created_at: checkin.createdAt,
  });
  if (error) throw error;
}

export async function deleteCheckin(habitId: string, date: string): Promise<void> {
  const { error } = await getSupabase()
    .from("habit_checkins")
    .delete()
    .eq("habit_id", habitId)
    .eq("date", date);
  if (error) throw error;
}
