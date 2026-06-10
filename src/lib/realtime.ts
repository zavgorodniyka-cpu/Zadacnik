"use client";

import { getSupabase } from "@/lib/supabase";

/** Tables that push changes to all open devices via Supabase Realtime. */
export const REALTIME_TABLES = [
  "tasks",
  "anniversaries",
  "folders",
  "ideas",
  "expenses",
  "habits",
  "habit_checkins",
  "lessons",
  "words",
] as const;

export type RealtimeTable = (typeof REALTIME_TABLES)[number];

export type RealtimeHandlers = Partial<Record<RealtimeTable, () => void | Promise<void>>>;

/**
 * Subscribe to Postgres row changes — other devices see updates immediately.
 */
export function subscribePlannerRealtime(
  userId: string,
  handlers: RealtimeHandlers,
  onStatus?: (status: string) => void,
): () => void {
  const supabase = getSupabase();
  const channel = supabase.channel(`planner-sync-${userId}`);

  for (const table of REALTIME_TABLES) {
    const handler = handlers[table];
    if (!handler) continue;

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      () => {
        void handler();
      },
    );
  }

  channel.subscribe((status) => {
    onStatus?.(status);
  });

  return () => {
    void supabase.removeChannel(channel);
  };
}
