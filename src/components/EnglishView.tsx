"use client";

import { useEffect, useMemo, useState } from "react";
import type { Lesson, Word } from "@/types/english";
import { generateId } from "@/lib/storage";
import {
  bulkInsertWords,
  deleteLesson as dbDeleteLesson,
  deleteWord as dbDeleteWord,
  fetchLessons,
  fetchWords,
  insertLesson as dbInsertLesson,
} from "@/lib/db/english";

type Props = {
  userId: string;
};

export default function EnglishView({ userId }: Props) {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(true);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const [showAddLesson, setShowAddLesson] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ls, ws] = await Promise.all([fetchLessons(), fetchWords()]);
        if (cancelled) return;
        setLessons(ls);
        setWords(ws);
      } catch (err) {
        console.error("[english]", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const wordsByLesson = useMemo(() => {
    const map = new Map<string, Word[]>();
    for (const w of words) {
      const arr = map.get(w.lessonId) ?? [];
      arr.push(w);
      map.set(w.lessonId, arr);
    }
    return map;
  }, [words]);

  async function handleCreateLesson(title: string, rawWords: string) {
    const lesson: Lesson = {
      id: generateId(),
      title: title.trim() || `Урок от ${new Date().toLocaleDateString("ru-RU")}`,
      createdAt: new Date().toISOString(),
    };
    const parsed = parseWords(rawWords);
    const newWords: Word[] = parsed.map((english) => ({
      id: generateId(),
      lessonId: lesson.id,
      english,
      translation: null,
      transcription: null,
      exampleEn: null,
      distractors: null,
      srsBox: 1,
      nextReviewAt: null,
      createdAt: new Date().toISOString(),
    }));

    setLessons((prev) => [lesson, ...prev]);
    setWords((prev) => [...prev, ...newWords]);
    setShowAddLesson(false);
    setOpenLessonId(lesson.id);

    try {
      await dbInsertLesson(lesson);
      await bulkInsertWords(newWords);
    } catch (err) {
      console.error("[english] create lesson failed", err);
    }
  }

  async function handleDeleteLesson(id: string) {
    if (!confirm("Удалить урок и все его слова?")) return;
    setLessons((prev) => prev.filter((l) => l.id !== id));
    setWords((prev) => prev.filter((w) => w.lessonId !== id));
    if (openLessonId === id) setOpenLessonId(null);
    try {
      await dbDeleteLesson(id);
    } catch (err) {
      console.error("[english] delete lesson failed", err);
    }
  }

  async function handleDeleteWord(id: string) {
    setWords((prev) => prev.filter((w) => w.id !== id));
    try {
      await dbDeleteWord(id);
    } catch (err) {
      console.error("[english] delete word failed", err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-zinc-500 dark:text-zinc-400">Загружаю уроки…</div>
      </div>
    );
  }

  const openLesson = openLessonId ? lessons.find((l) => l.id === openLessonId) ?? null : null;
  const openLessonWords = openLesson ? wordsByLesson.get(openLesson.id) ?? [] : [];

  if (openLesson) {
    return (
      <LessonDetail
        lesson={openLesson}
        words={openLessonWords}
        onBack={() => setOpenLessonId(null)}
        onDeleteWord={handleDeleteWord}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Мои уроки
        </h2>
        <button
          type="button"
          onClick={() => setShowAddLesson(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Новый урок
        </button>
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Пока ни одного урока. Нажми «Новый урок» — добавь название и закинь слова списком.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {lessons.map((l) => {
            const ws = wordsByLesson.get(l.id) ?? [];
            return (
              <li
                key={l.id}
                className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
              >
                <button
                  type="button"
                  onClick={() => setOpenLessonId(l.id)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium text-zinc-900 dark:text-zinc-50">
                    {l.title}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {ws.length} {pluralWords(ws.length)} · {formatDate(l.createdAt)}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteLesson(l.id)}
                  aria-label="Удалить урок"
                  className="rounded-lg p-2 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5L11 4" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showAddLesson && (
        <AddLessonForm
          defaultTitle={suggestNextTitle(lessons)}
          onClose={() => setShowAddLesson(false)}
          onSubmit={handleCreateLesson}
        />
      )}
    </div>
  );
}

function LessonDetail({
  lesson,
  words,
  onBack,
  onDeleteWord,
}: {
  lesson: Lesson;
  words: Word[];
  onBack: () => void;
  onDeleteWord: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 3l-5 5 5 5" />
        </svg>
        К списку уроков
      </button>

      <h2 className="mb-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
        {lesson.title}
      </h2>
      <p className="mb-6 text-xs text-zinc-500 dark:text-zinc-400">
        {words.length} {pluralWords(words.length)} · {formatDate(lesson.createdAt)}
      </p>

      {words.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            В уроке пока нет слов.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {words.map((w) => (
            <li
              key={w.id}
              className="group flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  {w.english}
                </div>
                {w.translation ? (
                  <div className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-300">
                    {w.translation}
                  </div>
                ) : (
                  <div className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                    перевод появится после обработки ИИ (следующее занятие)
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDeleteWord(w.id)}
                aria-label="Удалить слово"
                className="rounded-lg p-2 text-zinc-400 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 dark:hover:bg-red-950/40 dark:hover:text-red-400"
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 4h10M6.5 4V2.5h3V4M5 4l.5 9h5L11 4" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddLessonForm({
  defaultTitle,
  onClose,
  onSubmit,
}: {
  defaultTitle: string;
  onClose: () => void;
  onSubmit: (title: string, rawWords: string) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [rawWords, setRawWords] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(title, rawWords);
  }

  const previewCount = parseWords(rawWords).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Новый урок
        </h3>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Название урока
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Урок 1"
              autoFocus
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Слова и фразы
            </label>
            <textarea
              value={rawWords}
              onChange={(e) => setRawWords(e.target.value)}
              placeholder={"apple\ntable\nrun quickly\ngo to school"}
              rows={8}
              className="w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
            />
            <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              {previewCount > 0
                ? `Распознано слов: ${previewCount}`
                : "По одному слову/фразе на строку. Можно через запятую."}
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={previewCount === 0}
              className="flex-1 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Создать урок
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function parseWords(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function pluralWords(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "слов";
  if (mod10 === 1) return "слово";
  if (mod10 >= 2 && mod10 <= 4) return "слова";
  return "слов";
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  } catch {
    return "";
  }
}

function suggestNextTitle(lessons: Lesson[]): string {
  const numbers = lessons
    .map((l) => {
      const m = l.title.match(/Урок\s+(\d+)/i);
      return m ? parseInt(m[1], 10) : 0;
    })
    .filter((n) => n > 0);
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  return `Урок ${next}`;
}
