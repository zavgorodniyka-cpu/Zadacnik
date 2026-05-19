"use client";

import { useMemo, useState } from "react";
import type { Habit, HabitCheckin, HabitSchedule } from "@/types/habit";
import {
  buildCheckinIndex,
  calcBestStreak,
  calcLast30,
  calcStreak,
  isDoneOn,
  isScheduledOn,
  scheduleLabel,
  todayHabits,
} from "@/lib/habits";
import { todayISO } from "@/lib/dates";

type Props = {
  habits: Habit[];
  checkins: HabitCheckin[];
  onAdd: (habit: Habit) => void;
  onUpdate: (id: string, patch: Partial<Habit>) => void;
  onDelete: (id: string) => void;
  onToggleCheckin: (habitId: string, iso: string) => void;
  generateId: () => string;
};

const EMOJI_PRESETS = [
  "🏃", "💪", "🇬🇧", "📚", "💧", "🧘", "🍎", "💤", "🎯", "✍️",
  "🎵", "🎨", "📝", "🌱", "☕", "🚿", "🧹", "💊", "📷", "🙏",
];

export default function HabitsView({
  habits,
  checkins,
  onAdd,
  onUpdate,
  onDelete,
  onToggleCheckin,
  generateId,
}: Props) {
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState(false);

  const checkinIndex = useMemo(() => buildCheckinIndex(checkins), [checkins]);
  const today = todayISO();
  const todays = useMemo(() => todayHabits(habits), [habits]);

  return (
    <div className="flex flex-col gap-4">
      {/* Сегодняшние привычки — компактный чек-лист */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-base font-semibold tracking-tight text-orange-600 dark:text-orange-400">
            Сегодня
          </h2>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-orange-600 dark:hover:bg-orange-400"
          >
            + Привычка
          </button>
        </div>

        {todays.length === 0 ? (
          <p className="py-3 text-sm text-zinc-500 dark:text-zinc-400">
            {habits.length === 0
              ? "Пока нет привычек. Нажми «+ Привычка»."
              : "На сегодня привычек по расписанию нет."}
          </p>
        ) : (
          <ul className="space-y-1">
            {todays.map((h) => {
              const done = isDoneOn(checkinIndex, h.id, today);
              return (
                <li key={h.id}>
                  <button
                    type="button"
                    onClick={() => onToggleCheckin(h.id, today)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition",
                      done
                        ? "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-800/60",
                    ].join(" ")}
                  >
                    <span
                      aria-hidden
                      className={[
                        "flex h-6 w-6 flex-none items-center justify-center rounded-md border transition",
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950",
                      ].join(" ")}
                    >
                      {done && (
                        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8l3.5 3.5L13 5" />
                        </svg>
                      )}
                    </span>
                    {h.emoji && <span className="text-lg leading-none">{h.emoji}</span>}
                    <span
                      className={[
                        "flex-1 truncate text-sm",
                        done
                          ? "text-zinc-500 line-through dark:text-zinc-500"
                          : "text-zinc-900 dark:text-zinc-100",
                      ].join(" ")}
                    >
                      {h.name}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Список всех привычек со статистикой */}
      {habits.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Все привычки
          </h2>
          <ul className="space-y-3">
            {habits.map((h) => (
              <HabitRow
                key={h.id}
                habit={h}
                checkinIndex={checkinIndex}
                onEdit={() => setEditing(h)}
                onToggleDay={(iso) => onToggleCheckin(h.id, iso)}
              />
            ))}
          </ul>
        </div>
      )}

      {(creating || editing) && (
        <HabitForm
          habit={editing}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(name, emoji, schedule) => {
            if (editing) {
              onUpdate(editing.id, { name, emoji, schedule });
            } else {
              onAdd({
                id: generateId(),
                name,
                emoji,
                schedule,
                createdAt: new Date().toISOString(),
              });
            }
            setCreating(false);
            setEditing(null);
          }}
          onDelete={
            editing
              ? () => {
                  if (confirm(`Удалить привычку «${editing.name}»? История чекинов тоже удалится.`)) {
                    onDelete(editing.id);
                    setEditing(null);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function HabitRow({
  habit,
  checkinIndex,
  onEdit,
  onToggleDay,
}: {
  habit: Habit;
  checkinIndex: Set<string>;
  onEdit: () => void;
  onToggleDay: (iso: string) => void;
}) {
  const streak = useMemo(
    () => calcStreak(habit, checkinIndex),
    [habit, checkinIndex],
  );
  const best = useMemo(
    () => calcBestStreak(habit, checkinIndex),
    [habit, checkinIndex],
  );
  const last30 = useMemo(
    () => calcLast30(habit, checkinIndex),
    [habit, checkinIndex],
  );
  const percent =
    last30.scheduled > 0 ? Math.round((last30.done / last30.scheduled) * 100) : 0;

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-zinc-200/70 p-3 dark:border-zinc-800/70">
      <div className="flex items-center gap-2">
        {habit.emoji && <span className="text-lg leading-none">{habit.emoji}</span>}
        <button
          type="button"
          onClick={onEdit}
          className="flex-1 truncate text-left text-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
        >
          {habit.name}
        </button>
        {streak > 0 && (
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700 dark:bg-orange-950/50 dark:text-orange-300">
            🔥 {streak}
          </span>
        )}
      </div>
      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {scheduleLabel(habit.schedule)} · последние 30 дней: {last30.done}/{last30.scheduled} ({percent}%) · лучшая серия: {best}
      </div>
      <Heatmap days={last30.days} onClickDay={onToggleDay} />
    </li>
  );
}

function Heatmap({
  days,
  onClickDay,
}: {
  days: { iso: string; scheduled: boolean; done: boolean }[];
  onClickDay: (iso: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {days.map((d) => {
        let cls: string;
        if (d.done) {
          cls = "bg-emerald-500 hover:bg-emerald-600";
        } else if (d.scheduled) {
          cls = "bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700";
        } else {
          cls = "bg-transparent border border-dashed border-zinc-200 hover:bg-zinc-100 dark:border-zinc-800 dark:hover:bg-zinc-800/60";
        }
        return (
          <button
            key={d.iso}
            type="button"
            onClick={() => onClickDay(d.iso)}
            title={d.iso + (d.scheduled ? "" : " · вне расписания")}
            className={`h-3.5 w-3.5 rounded-sm transition ${cls}`}
          />
        );
      })}
    </div>
  );
}

function HabitForm({
  habit,
  onCancel,
  onSave,
  onDelete,
}: {
  habit: Habit | null;
  onCancel: () => void;
  onSave: (name: string, emoji: string | undefined, schedule: HabitSchedule) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(habit?.name ?? "");
  const [emoji, setEmoji] = useState<string | undefined>(habit?.emoji);
  const [scheduleKind, setScheduleKind] = useState<"daily" | "weekdays">(
    habit?.schedule.kind ?? "daily",
  );
  const [days, setDays] = useState<number[]>(
    habit?.schedule.kind === "weekdays" ? habit.schedule.days : [1, 2, 3, 4, 5],
  );

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const schedule: HabitSchedule =
      scheduleKind === "daily" ? { kind: "daily" } : { kind: "weekdays", days };
    onSave(trimmed, emoji, schedule);
  }

  function toggleDay(d: number) {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  }

  const dayButtons: { num: number; label: string }[] = [
    { num: 1, label: "Пн" },
    { num: 2, label: "Вт" },
    { num: 3, label: "Ср" },
    { num: 4, label: "Чт" },
    { num: 5, label: "Пт" },
    { num: 6, label: "Сб" },
    { num: 0, label: "Вс" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      onClick={onCancel}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-900"
      >
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          {habit ? "Редактировать привычку" : "Новая привычка"}
        </h3>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Название</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, бег"
            className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </label>

        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Эмодзи</span>
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setEmoji(undefined)}
              className={[
                "rounded-md border px-2 py-1 text-xs transition",
                !emoji
                  ? "border-orange-500 bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300"
                  : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
              ].join(" ")}
            >
              без
            </button>
            {EMOJI_PRESETS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                className={[
                  "rounded-md border px-2 py-1 text-base leading-none transition",
                  emoji === em
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-950/40"
                    : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800",
                ].join(" ")}
              >
                {em}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Расписание</span>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setScheduleKind("daily")}
              className={[
                "flex-1 rounded-md px-3 py-1.5 text-sm transition",
                scheduleKind === "daily"
                  ? "bg-white shadow-sm dark:bg-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400",
              ].join(" ")}
            >
              Каждый день
            </button>
            <button
              type="button"
              onClick={() => setScheduleKind("weekdays")}
              className={[
                "flex-1 rounded-md px-3 py-1.5 text-sm transition",
                scheduleKind === "weekdays"
                  ? "bg-white shadow-sm dark:bg-zinc-800"
                  : "text-zinc-600 dark:text-zinc-400",
              ].join(" ")}
            >
              По дням
            </button>
          </div>
          {scheduleKind === "weekdays" && (
            <div className="flex flex-wrap gap-1">
              {dayButtons.map((b) => {
                const active = days.includes(b.num);
                return (
                  <button
                    key={b.num}
                    type="button"
                    onClick={() => toggleDay(b.num)}
                    className={[
                      "rounded-md border px-3 py-1 text-xs font-medium transition",
                      active
                        ? "border-orange-500 bg-orange-500 text-white"
                        : "border-zinc-200 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800",
                    ].join(" ")}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Удалить
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg px-3 py-2 text-sm text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim() || (scheduleKind === "weekdays" && days.length === 0)}
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-orange-400"
            >
              Сохранить
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
