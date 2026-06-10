"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Status = "idle" | "sending" | "code" | "verifying" | "error";

const PENDING_KEY = "planner.login.pending";

function loadPending(): { email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { email?: string };
    if (!parsed.email) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}

function savePending(email: string) {
  sessionStorage.setItem(PENDING_KEY, JSON.stringify({ email }));
}

function clearPending() {
  sessionStorage.removeItem(PENDING_KEY);
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const pending = loadPending();
    if (pending) {
      setEmail(pending.email);
      setStatus("code");
    }
  }, []);

  async function handleRequestCode(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("sending");
    setErrorMsg("");
    savePending(trimmed);
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStatus("code");
    } catch (err) {
      // Письмо могло уйти, даже если ответ Supabase не дошёл (Safari / timeout).
      setStatus("code");
      setErrorMsg(
        "Ответ сервера задержался. Если код уже в почте — введите его ниже. Иначе нажмите «Отправить снова».",
      );
    }
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault();
    const token = code.trim();
    if (!token) return;
    setStatus("verifying");
    setErrorMsg("");
    try {
      const { error } = await getSupabase().auth.verifyOtp({
        email: email.trim(),
        token,
        type: "email",
      });
      if (error) throw error;
      clearPending();
      // session is set automatically; AuthGate перерисуется
    } catch (err) {
      setStatus("code");
      setErrorMsg(
        err instanceof Error ? err.message : "Неверный код. Попробуй ещё раз.",
      );
    }
  }

  function reset() {
    clearPending();
    setStatus("idle");
    setCode("");
    setErrorMsg("");
  }

  async function resendCode() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setResending(true);
    setErrorMsg("");
    savePending(trimmed);
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setErrorMsg("");
    } catch {
      setErrorMsg("Если новый код не пришёл — подождите минуту и попробуйте ещё раз.");
    } finally {
      setResending(false);
      setStatus("code");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Задачник
          </h1>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            Войди по email, чтобы данные синхронизировались между устройствами.
          </p>
        </div>

        {status === "code" || status === "verifying" || (status === "error" && code) ? (
          <form onSubmit={handleVerifyCode} className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              Код отправлен на <span className="font-mono">{email}</span>. Открой почту и скопируй 6-значный код сюда.
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Код из письма
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="код из письма"
                required
                autoFocus
                disabled={status === "verifying"}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-center text-lg tracking-[0.4em] text-zinc-900 outline-none transition focus:border-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
              />
            </div>

            {errorMsg && (
              <p className="text-xs text-amber-700 dark:text-amber-300">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "verifying" || code.length < 6}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {status === "verifying" ? "Проверяю…" : "Войти"}
            </button>

            <button
              type="button"
              onClick={resendCode}
              disabled={resending || status === "verifying"}
              className="block w-full text-center text-xs text-zinc-500 underline-offset-2 hover:underline disabled:opacity-40 dark:text-zinc-400"
            >
              {resending ? "Отправляю…" : "Отправить код снова"}
            </button>

            <button
              type="button"
              onClick={reset}
              className="block w-full text-center text-xs text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Ввести другой email
            </button>
          </form>
        ) : (
          <form onSubmit={handleRequestCode} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ты@example.com"
                required
                autoFocus
                disabled={status === "sending"}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
              />
            </div>

            {status === "error" && (
              <p className="text-xs text-red-600 dark:text-red-400">{errorMsg}</p>
            )}

            <button
              type="submit"
              disabled={status === "sending" || !email.trim()}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {status === "sending" ? "Отправляю…" : "Получить код"}
            </button>

            <p className="pt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
              На email придёт 6-значный код для входа.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
