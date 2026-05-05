"use client";

import type { Lesson, Word } from "@/types/english";
import { getSupabase } from "@/lib/supabase";

type DbLesson = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
};

type DbWord = {
  id: string;
  user_id: string;
  lesson_id: string;
  english: string;
  translation: string | null;
  transcription: string | null;
  example_en: string | null;
  distractors: string[] | null;
  srs_box: number;
  next_review_at: string | null;
  created_at: string;
};

function lessonFromDb(row: DbLesson): Lesson {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
  };
}

function lessonToDb(l: Lesson): Omit<DbLesson, "user_id"> {
  return {
    id: l.id,
    title: l.title,
    created_at: l.createdAt,
  };
}

function wordFromDb(row: DbWord): Word {
  return {
    id: row.id,
    lessonId: row.lesson_id,
    english: row.english,
    translation: row.translation,
    transcription: row.transcription,
    exampleEn: row.example_en,
    distractors: row.distractors,
    srsBox: row.srs_box,
    nextReviewAt: row.next_review_at,
    createdAt: row.created_at,
  };
}

function wordToDb(w: Word): Omit<DbWord, "user_id"> {
  return {
    id: w.id,
    lesson_id: w.lessonId,
    english: w.english,
    translation: w.translation,
    transcription: w.transcription,
    example_en: w.exampleEn,
    distractors: w.distractors,
    srs_box: w.srsBox,
    next_review_at: w.nextReviewAt,
    created_at: w.createdAt,
  };
}

export async function fetchLessons(): Promise<Lesson[]> {
  const { data, error } = await getSupabase()
    .from("lessons")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbLesson[]).map(lessonFromDb);
}

export async function insertLesson(l: Lesson): Promise<void> {
  const { error } = await getSupabase().from("lessons").insert(lessonToDb(l));
  if (error) throw error;
}

export async function updateLesson(id: string, patch: Partial<Lesson>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  const { error } = await getSupabase().from("lessons").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteLesson(id: string): Promise<void> {
  const { error } = await getSupabase().from("lessons").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchWords(): Promise<Word[]> {
  const { data, error } = await getSupabase()
    .from("words")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbWord[]).map(wordFromDb);
}

export async function insertWord(w: Word): Promise<void> {
  const { error } = await getSupabase().from("words").insert(wordToDb(w));
  if (error) throw error;
}

export async function bulkInsertWords(items: Word[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await getSupabase().from("words").insert(items.map(wordToDb));
  if (error) throw error;
}

export async function deleteWord(id: string): Promise<void> {
  const { error } = await getSupabase().from("words").delete().eq("id", id);
  if (error) throw error;
}
