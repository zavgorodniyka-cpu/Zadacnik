"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setStatus("sending");
    setErrorMsg("");
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: trimmed,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      setStatus("sent");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Не удалось отправить");
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
            Войди по email, чтобы данные жили в облаке и синхронизировались между устройствами.
          </p>
        </div>

        {status === "sent" ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
            <p className="font-medium">Письмо отправлено</p>
            <p className="mt-1">
              Проверь почту <span className="font-mono">{email}</span> — там ссылка для входа. Открой её на этом устройстве.
            </p>
            <button
              type="button"
              onClick={() => {
                setStatus("idle");
                setEmail("");
              }}
              className="mt-3 text-xs text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
            >
              Ввести другой email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
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
              {status === "sending" ? "Отправляю…" : "Получить ссылку"}
            </button>

            <p className="pt-2 text-center text-[11px] text-zinc-500 dark:text-zinc-400">
              Никаких паролей. На email придёт одноразовая ссылка для входа.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
