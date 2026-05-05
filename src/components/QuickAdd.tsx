"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseTask } from "@/lib/nlp";
import { formatHumanDate } from "@/lib/dates";

type Props = {
  onCreate: (data: {
    title: string;
    dueDate?: string;
    dueTime?: string;
    endTime?: string;
  }) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: { 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

export default function QuickAdd({ onCreate, inputRef }: Props) {
  const [text, setText] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    setVoiceSupported(!!SR);
  }, []);

  const preview = useMemo(() => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    return parseTask(trimmed);
  }, [text]);

  const hasParsedExtras = !!(preview && (preview.dueDate || preview.dueTime));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!preview || !preview.title) return;
    onCreate({
      title: preview.title,
      dueDate: preview.dueDate,
      dueTime: preview.dueTime,
      endTime: preview.endTime,
    });
    setText("");
  }

  function toggleVoice() {
    setVoiceError(null);
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setVoiceError("Голосовой ввод не поддерживается в этом браузере");
      return;
    }
    const recognition = new SR();
    recognition.lang = "ru-RU";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setText(transcript);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognition.onerror = (event) => {
      const code = event.error || "unknown";
      const message =
        code === "not-allowed" || code === "service-not-allowed"
          ? "Нет доступа к микрофону. Разреши его в настройках сайта."
          : code === "no-speech"
            ? "Ничего не услышал. Попробуй ещё раз."
            : `Ошибка распознавания: ${code}`;
      setVoiceError(message);
      setIsListening(false);
    };
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("[speech] start error", err);
      setVoiceError("Не удалось включить микрофон");
    }
  }

  return (
    <form onSubmit={submit} className="relative w-full sm:max-w-xs">
      <div className="flex items-center rounded-lg border border-zinc-200 bg-white shadow-sm transition focus-within:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-50">
        <span className="pl-3 pr-1 text-zinc-400">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
        </span>
        <span className="select-none whitespace-nowrap pr-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          Умный ввод ·
        </span>
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={isListening ? "Слушаю…" : "завтра в 15…"}
          className="flex-1 min-w-0 bg-transparent py-2 pr-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
        />
        {voiceSupported && (
          <button
            type="button"
            onClick={toggleVoice}
            aria-label={isListening ? "Остановить запись" : "Голосовой ввод"}
            title={isListening ? "Остановить" : "Надиктовать"}
            className={[
              "relative mr-1 flex-none rounded-md p-1.5 transition",
              isListening
                ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
            ].join(" ")}
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="2" width="4" height="8" rx="2" />
              <path d="M3 7v1a5 5 0 0010 0V7M8 13v2" />
            </svg>
            {isListening && (
              <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            )}
          </button>
        )}
      </div>
      {(hasParsedExtras || voiceError) && (
        <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-zinc-200 bg-white p-2 text-xs shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {voiceError ? (
            <div className="text-red-600 dark:text-red-400">{voiceError}</div>
          ) : (
            <>
              <div className="text-zinc-500 dark:text-zinc-400">Распознал:</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-zinc-900 dark:text-zinc-100">
                <span className="font-medium">{preview!.title || "(без названия)"}</span>
                {preview!.dueDate && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    {formatHumanDate(preview!.dueDate)}
                  </span>
                )}
                {preview!.dueTime && (
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono tabular-nums text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                    {preview!.dueTime}
                    {preview!.endTime ? `–${preview!.endTime}` : ""}
                  </span>
                )}
                <span className="text-zinc-400 dark:text-zinc-600">↵ создать</span>
              </div>
            </>
          )}
        </div>
      )}
    </form>
  );
}
