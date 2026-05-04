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
  const { data, error } = await supabase
    .from("anniversaries")
    .select("*")
    .eq("user_id", ownerUserId);
  if (error) {
    console.error("[cron/notify] fetch error", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const items = ((data ?? []) as DbRow[]).map(rowToAnniversary);

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

  if (todayItems.length === 0 && tomorrowDayBeforeItems.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const lines: string[] = [];
  if (todayItems.length > 0) {
    lines.push("🔔 Сегодня:");
    for (const a of todayItems) {
      const time = a.notify ? ` (${a.notify.time})` : "";
      lines.push(`• ${a.emoji ? a.emoji + " " : ""}${a.title}${time}`);
    }
  }
  if (tomorrowDayBeforeItems.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("📅 Завтра:");
    for (const a of tomorrowDayBeforeItems) {
      lines.push(`• ${a.emoji ? a.emoji + " " : ""}${a.title}`);
    }
  }

  await sendTelegramMessage(ownerChatId, lines.join("\n"));

  return NextResponse.json({
    ok: true,
    todayItems: todayItems.length,
    tomorrowDayBeforeItems: tomorrowDayBeforeItems.length,
    sent: 1,
  });
}
