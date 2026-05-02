import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { sendTelegramMessage } from "@/lib/telegram";
import { parseTask } from "@/lib/nlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TgMessage = {
  message_id: number;
  from?: { id: number; first_name?: string; username?: string };
  chat: { id: number; type: string };
  date: number;
  text?: string;
};

type TgUpdate = {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
};

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function ruDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

export async function POST(req: Request) {
  // Validate secret token from Telegram (set when configuring webhook).
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const incomingSecret = req.headers.get("x-telegram-bot-api-secret-token");
  if (expectedSecret && incomingSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: false, error: "bad-json" }, { status: 400 });
  }

  const message = update.message ?? update.edited_message;
  if (!message || !message.text) {
    return NextResponse.json({ ok: true, skip: "no-text" });
  }

  const chatId = message.chat.id;
  const ownerChatIdRaw = process.env.TELEGRAM_OWNER_CHAT_ID;
  const ownerUserId = process.env.OWNER_USER_ID;

  // Reply to /start before owner check so the user can find their chat_id.
  if (message.text.trim().startsWith("/start") || message.text.trim() === "/whoami") {
    await sendTelegramMessage(
      chatId,
      `Привет! Твой chat_id: ${chatId}\n\nПопроси админа добавить этот id в TELEGRAM_OWNER_CHAT_ID, чтобы бот тебя слушал.`,
    );
    return NextResponse.json({ ok: true });
  }

  if (!ownerChatIdRaw || !ownerUserId) {
    await sendTelegramMessage(
      chatId,
      "Бот ещё не настроен (нет TELEGRAM_OWNER_CHAT_ID или OWNER_USER_ID).",
    );
    return NextResponse.json({ ok: true });
  }

  if (String(chatId) !== String(ownerChatIdRaw)) {
    await sendTelegramMessage(chatId, "Этот бот принимает сообщения только от владельца.");
    return NextResponse.json({ ok: true });
  }

  if (message.text.trim().startsWith("/help")) {
    await sendTelegramMessage(
      chatId,
      [
        "Просто напиши задачу обычным текстом.",
        "Понимаю даты и время:",
        "• Купить хлеб завтра в 18:00",
        "• Позвонить маме в пятницу",
        "• Отчёт 15 мая",
        "",
        "Команды:",
        "/whoami — показать твой chat_id",
        "/help — эта справка",
      ].join("\n"),
    );
    return NextResponse.json({ ok: true });
  }

  // Parse and create task.
  const parsed = parseTask(message.text);
  if (!parsed.title) {
    await sendTelegramMessage(chatId, "Не понял текст задачи 🤔");
    return NextResponse.json({ ok: true });
  }

  // If user gave a time but no day, anchor to today (or tomorrow if already past).
  // Vercel runs in UTC, so resolve "today" in the owner's timezone (default Moscow).
  let dueDate = parsed.dueDate;
  if (!dueDate && parsed.dueTime) {
    const tz = process.env.OWNER_TIMEZONE || "Europe/Moscow";
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
    );
    let y = Number(parts.year);
    let mo = Number(parts.month);
    let d = Number(parts.day);
    const nowH = Number(parts.hour);
    const nowM = Number(parts.minute);
    const [h, m] = parsed.dueTime.split(":").map(Number);
    if (h * 60 + m <= nowH * 60 + nowM) {
      const next = new Date(Date.UTC(y, mo - 1, d + 1));
      y = next.getUTCFullYear();
      mo = next.getUTCMonth() + 1;
      d = next.getUTCDate();
    }
    dueDate = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }

  const supabase = getSupabaseAdmin();
  const id = generateId();
  const { error } = await supabase.from("tasks").insert({
    id,
    user_id: ownerUserId,
    title: parsed.title,
    status: "todo",
    due_date: dueDate ?? null,
    due_time: parsed.dueTime ?? null,
    end_time: parsed.endTime ?? null,
    tags: [],
    source: "telegram",
    external_id: String(message.message_id),
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[telegram webhook] insert error", error);
    await sendTelegramMessage(chatId, `Ошибка сохранения: ${error.message}`);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const datePart = dueDate ? ` 📅 ${ruDate(dueDate)}` : "";
  const timePart = parsed.dueTime
    ? ` ⏰ ${parsed.dueTime}${parsed.endTime ? `–${parsed.endTime}` : ""}`
    : "";
  await sendTelegramMessage(
    chatId,
    `✅ Создал задачу: ${parsed.title}${datePart}${timePart}`,
  );

  return NextResponse.json({ ok: true, id });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Telegram webhook is alive" });
}
