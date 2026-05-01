import type { Folder } from "@/types/folder";
import { generateId } from "./storage";

const DEFAULT_FOLDERS: Array<{ name: string; emoji: string }> = [
  { name: "Дом", emoji: "🏠" },
  { name: "Баня", emoji: "🧖" },
  { name: "Работа", emoji: "💼" },
  { name: "Семья", emoji: "👪" },
  { name: "Документы", emoji: "📁" },
];

export function createDefaultFolders(): Folder[] {
  const createdAt = new Date().toISOString();
  return DEFAULT_FOLDERS.map((d) => ({
    id: generateId(),
    name: d.name,
    emoji: d.emoji,
    createdAt,
  }));
}

export function clearLocalEntityStorage(): void {
  if (typeof window === "undefined") return;
  const keys = [
    "planner.tasks.v1",
    "planner.anniversaries.v1",
    "planner.folders.v1",
    "planner.ideas.v1",
    "planner.recurring.v1",
    "planner.folders.seeded.v1",
  ];
  for (const k of keys) window.localStorage.removeItem(k);
}
