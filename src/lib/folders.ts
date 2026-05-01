"use client";

import type { Folder, IdeaItem } from "@/types/folder";
import { generateId } from "./storage";

const FOLDERS_KEY = "planner.folders.v1";
const IDEAS_KEY = "planner.ideas.v1";
const SEEDED_FLAG = "planner.folders.seeded.v1";

const DEFAULT_FOLDERS: Array<{ name: string; emoji: string }> = [
  { name: "Дом", emoji: "🏠" },
  { name: "Баня", emoji: "🧖" },
  { name: "Работа", emoji: "💼" },
  { name: "Семья", emoji: "👪" },
  { name: "Документы", emoji: "📁" },
];

export function loadFolders(): Folder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FOLDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Folder[]) : [];
  } catch {
    return [];
  }
}

export function saveFolders(items: Folder[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FOLDERS_KEY, JSON.stringify(items));
}

export function loadIdeas(): IdeaItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IDEAS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as IdeaItem[]) : [];
  } catch {
    return [];
  }
}

export function saveIdeas(items: IdeaItem[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(IDEAS_KEY, JSON.stringify(items));
}

export function seedFoldersOnce(existing: Folder[]): Folder[] | null {
  if (typeof window === "undefined") return null;
  if (window.localStorage.getItem(SEEDED_FLAG)) return null;
  if (existing.length > 0) {
    window.localStorage.setItem(SEEDED_FLAG, "true");
    return null;
  }
  const createdAt = new Date().toISOString();
  const seeded: Folder[] = DEFAULT_FOLDERS.map((d) => ({
    id: generateId(),
    name: d.name,
    emoji: d.emoji,
    createdAt,
  }));
  window.localStorage.setItem(SEEDED_FLAG, "true");
  return seeded;
}

export function extractDomain(url: string): string | null {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
