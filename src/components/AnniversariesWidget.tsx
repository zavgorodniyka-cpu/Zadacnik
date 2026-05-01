"use client";

import { useMemo, useState } from "react";
import type {
  Anniversary,
  AnniversaryNotify,
  Recurrence,
} from "@/types/anniversary";
import type { ReminderMode } from "@/types/task";
import { formatHumanDate, todayISO } from "@/lib/dates";
import { nextOccurrence, recurrenceLabel } from "@/lib/anniversaries";

type Props = {
  anniversaries: Anniversary[];
  onAdd: (a: Anniversary) => void;
  onUpdate: (id: string, patch: Partial<Anniversary>) => void;
  onDelete: (id: string) => void;
  generateId: () => string;
};

const EMOJI_PRESETS = ["🎂", "🎁", "💍", "🎉", "❤️", "👶", "🎓", "✈️", "🏖️", "📌"];

export default function AnniversariesWidget({
  anniversaries,
  onAdd,
  onUpdate,
  onDelete,
  generateId,
}: Props) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const today = new Date();
    return [...anniversaries].sort((a, b) => {
      const an = nextOccurrence(a, today);
      const bn = nextOccurrence(b, today);
      const at = an ? an.getTime() : Number.POSITIVE_INFINITY;
      const bt = bn ? bn.getTime() : Number.POSITIVE_INFINITY;
      return at - bt;
    });
  }, [anniversaries]);

  function submitDraft(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    const a: Anniversary = {
      id: generateId(),
      title: trimmed,
      startDate: todayISO(),
      recurrence: "yearly",
      createdAt: new Date().toISOString(),
    };
    onAdd(a);
    setDraft("");
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-3 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        🎉 Напоминания
      </h2>

      <form onSubmit={submitDraft} className="mb-3">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="ДР мамы, годовщина, дедлайн…"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </form>

      {sorted.length === 0 ? (
        <p className="py-3 text-sm text-zinc-400 dark:text-zinc-600">
          Пусто. Добавь напоминание — оно будет повторяться.
        </p>
      ) : (
        <ul className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
          {sorted.map((a) =>
            editingId === a.id ? (
              <EditRow
                key={a.id}
                anniversary={a}
                onSave={(patch) => {
                  onUpdate(a.id, patch);
                  setEditingId(null);
                }}
                onDelete={() => {
                  onDelete(a.id);
                  setEditingId(null);
                }}
                onCancel={() => setEditingId(null)}
              />
            ) : (
              <DisplayRow
                key={a.id}
                anniversary={a}
                onEdit={() => setEditingId(a.id)}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function DisplayRow({
  anniversary: a,
  onEdit,
}: {
  anniversary: Anniversary;
  onEdit: () => void;
}) {
  const next = nextOccurrence(a);
  const nextLabel = next
    ? formatHumanDate(`${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`)
    : "—";

  return (
    <li>
      <button
        type="button"
        onClick={onEdit}
        className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-zinc-800 dark:hover:bg-zinc-900"
      >
        <span className="flex-none text-xl">{a.emoji ?? "📌"}</span>
        <div className="flex-1 min-w-0">
          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {a.title}
          </span>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
            <span>{nextLabel}</span>
            <span>·</span>
            <span>{recurrenceLabel(a.recurrence)}</span>
            {a.notify && (
              <>
                <span>·</span>
                <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                  <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v1M4 6a4 4 0 018 0c0 4 1.5 5 1.5 5h-11S4 10 4 6zM6.5 13a1.5 1.5 0 003 0" />
                  </svg>
                  {a.notify.time}
                </span>
              </>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}

function EditRow({
  anniversary: a,
  onSave,
  onDelete,
  onCancel,
}: {
  anniversary: Anniversary;
  onSave: (patch: Partial<Anniversary>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(a.title);
  const [emoji, setEmoji] = useState(a.emoji ?? "");
  const [startDate, setStartDate] = useState(a.startDate);
  const [recurrence, setRecurrence] = useState<Recurrence>(a.recurrence);
  const [notify, setNotify] = useState<AnniversaryNotify | undefined>(a.notify);
  const [notes, setNotes] = useState(a.notes ?? "");

  function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSave({
      title: trimmed,
      emoji: emoji.trim() || undefined,
      startDate,
      recurrence,
      notify,
      notes: notes.trim() || undefined,
    });
  }

  function setNotifyMode(mode: ReminderMode) {
    setNotify({ mode, time: notify?.time ?? "09:00" });
  }
  function setNotifyTime(time: string) {
    setNotify({ mode: notify?.mode ?? "same_day", time });
  }

  return (
    <li className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-2 flex items-center gap-2">
        <input
          type="text"
          value={emoji}
          onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
          placeholder="🎉"
          className="w-12 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-center text-base outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-zinc-50"
        />
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Название"
          autoFocus
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </div>

      <div className="mb-2 flex flex-wrap gap-1">
        {EMOJI_PRESETS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEmoji(e)}
            className={[
              "rounded-md px-1.5 py-0.5 text-base transition hover:bg-zinc-200 dark:hover:bg-zinc-800",
              emoji === e ? "bg-zinc-200 dark:bg-zinc-800" : "",
            ].join(" ")}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Дата
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Повтор
          </label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as Recurrence)}
            className="w-full rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          >
            <option value="yearly">Каждый год</option>
            <option value="monthly">Каждый месяц</option>
            <option value="weekly">Каждую неделю</option>
            <option value="daily">Каждый день</option>
            <option value="none">Не повторять</option>
          </select>
        </div>
      </div>

      <div className="mb-2">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Напоминание
          </label>
          {notify && (
            <button
              type="button"
              onClick={() => setNotify(undefined)}
              className="text-[11px] text-red-600 transition hover:underline dark:text-red-400"
            >
              убрать
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="grid flex-1 grid-cols-3 gap-1 rounded-lg bg-white p-1 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setNotify(undefined)}
              className={[
                "rounded-md px-2 py-1 text-[11px] font-medium transition",
                !notify
                  ? "bg-zinc-100 text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              Без
            </button>
            <button
              type="button"
              onClick={() => setNotifyMode("day_before")}
              className={[
                "rounded-md px-2 py-1 text-[11px] font-medium transition",
                notify?.mode === "day_before"
                  ? "bg-zinc-100 text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              За день
            </button>
            <button
              type="button"
              onClick={() => setNotifyMode("same_day")}
              className={[
                "rounded-md px-2 py-1 text-[11px] font-medium transition",
                notify?.mode === "same_day"
                  ? "bg-zinc-100 text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
              ].join(" ")}
            >
              В день
            </button>
          </div>
          <input
            type="time"
            value={notify?.time ?? "09:00"}
            disabled={!notify}
            onChange={(e) => setNotifyTime(e.target.value)}
            className="w-24 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </div>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Заметка (необязательно)"
        rows={2}
        className="mb-2 w-full resize-none rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={!title.trim()}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Сохранить
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-2 py-1.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="ml-auto rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
        >
          Удалить
        </button>
      </div>
    </li>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
