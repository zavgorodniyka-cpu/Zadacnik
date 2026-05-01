"use client";

import { useMemo } from "react";
import type { Task } from "@/types/task";
import TagPill from "./TagPill";

type Props = {
  tasks: Task[];
  hidden: Set<string>;
  onToggle: (tag: string) => void;
  onReset: () => void;
};

export default function TagFilterBar({ tasks, hidden, onToggle, onReset }: Props) {
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of tasks) {
      if (t.status === "done") continue;
      for (const tag of t.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [tasks]);

  if (tags.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="mr-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Метки:
      </span>
      {tags.map(([tag, count]) => (
        <span key={tag} className="inline-flex items-center gap-1">
          <TagPill
            tag={tag}
            muted={hidden.has(tag)}
            onClick={() => onToggle(tag)}
          />
          <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
            {count}
          </span>
        </span>
      ))}
      {hidden.size > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="ml-1 text-xs text-zinc-500 underline-offset-2 transition hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          сбросить
        </button>
      )}
    </div>
  );
}
