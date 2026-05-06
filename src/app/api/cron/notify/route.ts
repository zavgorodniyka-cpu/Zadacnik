import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram";
import { nextOccurrence } from "@/lib/anniversaries";
import type { Anniversary, AnniversaryNotify, Recurrence } from "@/types/anniversary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DbRow = {
  id: string;
  title: string;
  emoji: string | null;
  start_date: string;
  recurrence: Recurrence;
  notify: AnniversaryNotify | null;
  notes: string | null;
  created_at: string;
};

type DbTaskRow = {
  id: string;
  title: string;
  priority: string | null;
  due_date: string | null;
  due_time: string | null;
  end_time: string | null;
};

function rowToAnniversary(r: DbRow): Anniversary {
  return {
    id: r.id,
    title: r.title,
    emoji: r.emoji ?? undefined,
    startDate: r.start_date,
    recurrence: r.recurrence,
    notify: r.notify ?? undefined,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

function localToday(tz: string): Date {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
}

function isoFromDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
  }

  const ownerChatId = process.env.TELEGRAM_OWNER_CHAT_ID;
  const ownerUserId = process.env.OWNER_USER_ID;
  if (!ownerChatId || !ownerUserId) {
    return NextResponse.json(
      { ok: false, error: "owner not configured" },
      { status: 500 },
    );
  }

  const tz = process.env.OWNER_TIMEZONE || "Europe/Moscow";
  const today = localToday(tz);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayIso = isoFromDate(today);
  const tomorrowIso = isoFromDate(tomorrow);

  const supabase = getSupabaseAdmin();

  const [{ data: anniversaryData, error: aErr }, { data: taskData, error: tErr }] =
    await Promise.all([
      supabase.from("anniversaries").select("*").eq("user_id", ownerUserId),
      supabase
        .from("tasks")
        .select("id, title, priority, due_date, due_time, end_time")
        .eq("user_id", ownerUserId)
        .eq("priority", "high")
        .neq("status", "done")
        .in("due_date", [todayIso, tomorrowIso]),
    ]);
  if (aErr) {
    console.error("[cron/notify] anniversaries fetch error", aErr);
    return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  }
  if (tErr) {
    console.error("[cron/notify] tasks fetch error", tErr);
    return NextResponse.json({ ok: false, error: tErr.message }, { status: 500 });
  }

  const items = ((anniversaryData ?? []) as DbRow[]).map(rowToAnniversary);
  const tasks = (taskData ?? []) as DbTaskRow[];

  const todayItems: Anniversary[] = [];
  const tomorrowDayBeforeItems: Anniversary[] = [];

  for (const a of items) {
    if (!a.notify) continue;
    const next = nextOccurrence(a, today);
    if (!next) continue;
    const nextIso = isoFromDate(next);
    if (a.notify.mode === "same_day" && nextIso === todayIso) {
      todayItems.push(a);
    } else if (a.notify.mode === "day_before" && nextIso === tomorrowIso) {
      tomorrowDayBeforeItems.push(a);
    }
  }

  const todayTasks = tasks.filter((t) => t.due_date === todayIso);
  const tomorrowTasks = tasks.filter((t) => t.due_date === tomorrowIso);

  if (
    todayItems.length === 0 &&
    tomorrowDayBeforeItems.length === 0 &&
    todayTasks.length === 0 &&
    tomorrowTasks.length === 0
  ) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  function taskLine(t: DbTaskRow): string {
    const time = t.due_time
      ? ` (${t.due_time}${t.end_time ? `–${t.end_time}` : ""})`
      : "";
    return `• ‼️ ${t.title}${time}`;
  }

  const lines: string[] = [];
  if (todayItems.length > 0 || todayTasks.length > 0) {
    lines.push("🔔 Сегодня:");
    for (const a of todayItems) {
      const time = a.notify ? ` (${a.notify.time})` : "";
      lines.push(`• ${a.emoji ? a.emoji + " " : ""}${a.title}${time}`);
    }
    for (const t of todayTasks) lines.push(taskLine(t));
  }
  if (tomorrowDayBeforeItems.length > 0 || tomorrowTasks.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("📅 Завтра:");
    for (const a of tomorrowDayBeforeItems) {
      lines.push(`• ${a.emoji ? a.emoji + " " : ""}${a.title}`);
    }
    for (const t of tomorrowTasks) lines.push(taskLine(t));
  }

  await sendTelegramMessage(ownerChatId, lines.join("\n"));

  return NextResponse.json({
    ok: true,
    todayItems: todayItems.length,
    tomorrowDayBeforeItems: tomorrowDayBeforeItems.length,
    todayTasks: todayTasks.length,
    tomorrowTasks: tomorrowTasks.length,
    sent: 1,
  });
}
