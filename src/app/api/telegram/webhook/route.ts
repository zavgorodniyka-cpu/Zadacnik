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

function getOwnerTz(): string {
  return process.env.OWNER_TIMEZONE || "Europe/Moscow";
}

function todayIsoInTz(tz: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const HELP_TEXT = [
  "Просто напиши задачу обычным текстом.",
  "Понимаю даты и время:",
  "• Купить хлеб завтра в 18:00",
  "• Позвонить маме в пятницу",
  "• Отчёт 15 мая",
  "",
  "Команды:",
  "/expense <сумма> <категория> [описание] — записать трату",
  "  пример: /expense 1500 продукты молоко хлеб",
  "/idea <текст или ссылка> [в папку <название>] — записать идею",
  "  пример: /idea https://example.com статья в папку чтение",
  "/word <слово> [- перевод] — добавить слово на изучение",
  "  пример: /word resilience - стойкость",
  "/whoami — показать твой chat_id",
  "/help — эта справка",
].join("\n");

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
  const text = message.text.trim();

  // Reply to /start before owner check so the user can find their chat_id.
  if (text.startsWith("/start") || text === "/whoami") {
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

  if (text.startsWith("/help")) {
    await sendTelegramMessage(chatId, HELP_TEXT);
    return NextResponse.json({ ok: true });
  }

  const supabase = getSupabaseAdmin();

  // ---------- /expense ----------
  if (text.startsWith("/expense")) {
    const args = text.slice("/expense".length).trim();
    if (!args) {
      await sendTelegramMessage(
        chatId,
        "Формат: /expense <сумма> <категория> [описание]\nПример: /expense 1500 продукты молоко хлеб",
      );
      return NextResponse.json({ ok: true });
    }
    const parts = args.split(/\s+/);
    const amount = Number(parts[0]?.replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendTelegramMessage(
        chatId,
        "Не понял сумму. Формат: /expense 1500 продукты [описание]",
      );
      return NextResponse.json({ ok: true });
    }
    const category = parts[1] ?? "Прочее";
    const description = parts.slice(2).join(" ") || null;

    const { error } = await supabase.from("expenses").insert({
      id: generateId(),
      user_id: ownerUserId,
      date: todayIsoInTz(getOwnerTz()),
      category,
      description,
      amount,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[telegram webhook] expense error", error);
      await sendTelegramMessage(chatId, `Ошибка: ${error.message}`);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const desc = description ? ` · ${description}` : "";
    await sendTelegramMessage(
      chatId,
      `💸 Записал трату: ${amount} ₽ · ${category}${desc}`,
    );
    return NextResponse.json({ ok: true });
  }

  // ---------- /idea ----------
  if (text.startsWith("/idea")) {
    let args = text.slice("/idea".length).trim();
    if (!args) {
      await sendTelegramMessage(
        chatId,
        "Формат: /idea <текст или ссылка> [в папку <название>]\nПример: /idea https://example.com статья в папку чтение",
      );
      return NextResponse.json({ ok: true });
    }

    // Extract optional "в папку <name>" — take everything after as folder name.
    let folderName: string | null = null;
    const lower = args.toLowerCase();
    const folderIdx = lower.lastIndexOf(" в папку ");
    const startsWithMarker = lower.startsWith("в папку ");
    if (folderIdx >= 0) {
      folderName = args.slice(folderIdx + " в папку ".length).trim();
      args = args.slice(0, folderIdx).trim();
    } else if (startsWithMarker) {
      folderName = args.slice("в папку ".length).trim();
      args = "";
    }

    const urlMatch = args.match(/(https?:\/\/[^\s]+)/);
    const url = urlMatch ? urlMatch[1] : null;
    let title = url ? args.replace(url, "").trim() : args;
    if (!title) title = url ?? "Без названия";

    // Resolve folder: by name (fuzzy) if specified, else use first existing.
    let folderId: string | undefined;
    let folderLabel: string | null = null;
    if (folderName) {
      const { data: matches } = await supabase
        .from("folders")
        .select("id, name, emoji")
        .eq("user_id", ownerUserId)
        .ilike("name", `%${folderName}%`)
        .limit(1);
      if (matches && matches.length > 0) {
        folderId = matches[0].id as string;
        const m = matches[0] as { name: string; emoji?: string };
        folderLabel = `${m.emoji ? m.emoji + " " : ""}${m.name}`;
      } else {
        folderId = generateId();
        const created = {
          id: folderId,
          user_id: ownerUserId,
          name: folderName,
          emoji: null as string | null,
          created_at: new Date().toISOString(),
        };
        const { error: folderErr } = await supabase.from("folders").insert(created);
        if (folderErr) {
          console.error("[telegram webhook] folder create error", folderErr);
          await sendTelegramMessage(chatId, `Ошибка создания папки: ${folderErr.message}`);
          return NextResponse.json({ ok: false, error: folderErr.message }, { status: 500 });
        }
        folderLabel = `новая «${folderName}»`;
      }
    } else {
      const { data: folders } = await supabase
        .from("folders")
        .select("id, name, emoji")
        .eq("user_id", ownerUserId)
        .order("created_at", { ascending: true })
        .limit(1);
      if (folders && folders.length > 0) {
        folderId = folders[0].id as string;
        const f = folders[0] as { name: string; emoji?: string };
        folderLabel = `${f.emoji ? f.emoji + " " : ""}${f.name}`;
      } else {
        folderId = generateId();
        const { error: folderErr } = await supabase.from("folders").insert({
          id: folderId,
          user_id: ownerUserId,
          name: "Идеи",
          emoji: "💡",
          created_at: new Date().toISOString(),
        });
        if (folderErr) {
          console.error("[telegram webhook] folder error", folderErr);
          await sendTelegramMessage(chatId, `Ошибка: ${folderErr.message}`);
          return NextResponse.json({ ok: false, error: folderErr.message }, { status: 500 });
        }
        folderLabel = "💡 Идеи";
      }
    }

    const { error } = await supabase.from("ideas").insert({
      id: generateId(),
      user_id: ownerUserId,
      folder_id: folderId,
      title,
      url,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[telegram webhook] idea error", error);
      await sendTelegramMessage(chatId, `Ошибка: ${error.message}`);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const where = folderLabel ? `\nПапка: ${folderLabel}` : "";
    await sendTelegramMessage(chatId, `💡 Записал идею: ${title}${where}`);
    return NextResponse.json({ ok: true });
  }

  // ---------- /word ----------
  if (text.startsWith("/word")) {
    const args = text.slice("/word".length).trim();
    if (!args) {
      await sendTelegramMessage(
        chatId,
        "Формат: /word <слово> [- перевод]\nПример: /word resilience - стойкость",
      );
      return NextResponse.json({ ok: true });
    }
    let english: string;
    let translation: string | null;
    if (args.includes(" - ")) {
      const idx = args.indexOf(" - ");
      english = args.slice(0, idx).trim();
      translation = args.slice(idx + 3).trim() || null;
    } else {
      const sp = args.indexOf(" ");
      if (sp === -1) {
        english = args;
        translation = null;
      } else {
        english = args.slice(0, sp).trim();
        translation = args.slice(sp + 1).trim() || null;
      }
    }
    if (!english) {
      await sendTelegramMessage(chatId, "Не понял слово.");
      return NextResponse.json({ ok: true });
    }

    // Find or create a "Из Telegram" lesson.
    const { data: lessons } = await supabase
      .from("lessons")
      .select("id")
      .eq("user_id", ownerUserId)
      .order("created_at", { ascending: false })
      .limit(1);
    let lessonId = lessons?.[0]?.id as string | undefined;
    if (!lessonId) {
      lessonId = generateId();
      const { error: lessonErr } = await supabase.from("lessons").insert({
        id: lessonId,
        user_id: ownerUserId,
        title: "Из Telegram",
        created_at: new Date().toISOString(),
      });
      if (lessonErr) {
        console.error("[telegram webhook] lesson error", lessonErr);
        await sendTelegramMessage(chatId, `Ошибка: ${lessonErr.message}`);
        return NextResponse.json({ ok: false, error: lessonErr.message }, { status: 500 });
      }
    }

    const { error } = await supabase.from("words").insert({
      id: generateId(),
      user_id: ownerUserId,
      lesson_id: lessonId,
      english,
      translation,
      srs_box: 1,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error("[telegram webhook] word error", error);
      await sendTelegramMessage(chatId, `Ошибка: ${error.message}`);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
    const tr = translation ? ` — ${translation}` : "";
    await sendTelegramMessage(chatId, `🇬🇧 Добавил слово: ${english}${tr}`);
    return NextResponse.json({ ok: true });
  }

  // ---------- default: parse as task ----------
  const parsed = parseTask(message.text);
  if (!parsed.title) {
    await sendTelegramMessage(chatId, "Не понял текст задачи 🤔");
    return NextResponse.json({ ok: true });
  }

  // If user gave a time but no day, anchor to today (or tomorrow if already past).
  // Vercel runs in UTC, so resolve "today" in the owner's timezone (default Moscow).
  let dueDate = parsed.dueDate;
  if (!dueDate && parsed.dueTime) {
    const tz = getOwnerTz();
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

  const whenParts: string[] = [];
  if (dueDate) whenParts.push(ruDate(dueDate));
  if (parsed.dueTime) {
    whenParts.push(
      `в ${parsed.dueTime}${parsed.endTime ? `–${parsed.endTime}` : ""}`,
    );
  }
  const when = whenParts.length > 0 ? `\nКогда: ${whenParts.join(", ")}` : "";
  await sendTelegramMessage(chatId, `✅ Создал задачу: ${parsed.title}${when}`);

  return NextResponse.json({ ok: true, id });
}

export async function GET() {
  return NextResponse.json({ ok: true, message: "Telegram webhook is alive" });
}
