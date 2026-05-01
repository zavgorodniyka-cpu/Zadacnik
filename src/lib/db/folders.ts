"use client";

import type { Folder, IdeaItem } from "@/types/folder";
import { getSupabase } from "@/lib/supabase";

type DbFolder = {
  id: string;
  user_id: string;
  name: string;
  emoji: string | null;
  created_at: string;
};

type DbIdea = {
  id: string;
  user_id: string;
  folder_id: string;
  title: string;
  url: string | null;
  notes: string | null;
  created_at: string;
};

function folderFromDb(row: DbFolder): Folder {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji ?? undefined,
    createdAt: row.created_at,
  };
}

function folderToDb(f: Folder): Omit<DbFolder, "user_id"> {
  return {
    id: f.id,
    name: f.name,
    emoji: f.emoji ?? null,
    created_at: f.createdAt,
  };
}

function ideaFromDb(row: DbIdea): IdeaItem {
  return {
    id: row.id,
    folderId: row.folder_id,
    title: row.title,
    url: row.url ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function ideaToDb(i: IdeaItem): Omit<DbIdea, "user_id"> {
  return {
    id: i.id,
    folder_id: i.folderId,
    title: i.title,
    url: i.url ?? null,
    notes: i.notes ?? null,
    created_at: i.createdAt,
  };
}

export async function fetchFolders(): Promise<Folder[]> {
  const { data, error } = await getSupabase()
    .from("folders")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as DbFolder[]).map(folderFromDb);
}

export async function insertFolder(f: Folder): Promise<void> {
  const { error } = await getSupabase().from("folders").insert(folderToDb(f));
  if (error) throw error;
}

export async function bulkInsertFolders(items: Folder[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await getSupabase().from("folders").insert(items.map(folderToDb));
  if (error) throw error;
}

export async function updateFolder(id: string, patch: Partial<Folder>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.emoji !== undefined) dbPatch.emoji = patch.emoji ?? null;
  const { error } = await getSupabase().from("folders").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteFolder(id: string): Promise<void> {
  const { error } = await getSupabase().from("folders").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchIdeas(): Promise<IdeaItem[]> {
  const { data, error } = await getSupabase()
    .from("ideas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as DbIdea[]).map(ideaFromDb);
}

export async function insertIdea(i: IdeaItem): Promise<void> {
  const { error } = await getSupabase().from("ideas").insert(ideaToDb(i));
  if (error) throw error;
}

export async function bulkInsertIdeas(items: IdeaItem[]): Promise<void> {
  if (items.length === 0) return;
  const { error } = await getSupabase().from("ideas").insert(items.map(ideaToDb));
  if (error) throw error;
}

export async function updateIdea(id: string, patch: Partial<IdeaItem>): Promise<void> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.title !== undefined) dbPatch.title = patch.title;
  if (patch.url !== undefined) dbPatch.url = patch.url ?? null;
  if (patch.notes !== undefined) dbPatch.notes = patch.notes ?? null;
  const { error } = await getSupabase().from("ideas").update(dbPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteIdea(id: string): Promise<void> {
  const { error } = await getSupabase().from("ideas").delete().eq("id", id);
  if (error) throw error;
}
