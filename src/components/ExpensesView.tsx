"use client";

import { useMemo, useRef, useState } from "react";
import type { Expense } from "@/types/expense";
import { todayISO } from "@/lib/dates";
import { parseExpensesCsv } from "@/lib/expenses-import";
import ExpenseChart from "./ExpenseChart";

type Props = {
  expenses: Expense[];
  onAdd: (e: Expense) => void;
  onAddBulk: (items: Expense[]) => void;
  onUpdate: (id: string, patch: Partial<Expense>) => void;
  onDelete: (id: string) => void;
  generateId: () => string;
};

const RUB = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

export default function ExpensesView({
  expenses,
  onAdd,
  onAddBulk,
  onUpdate,
  onDelete,
  generateId,
}: Props) {
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [filterFrom, setFilterFrom] = useState<string>("");
  const [filterTo, setFilterTo] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) set.add(e.category);
    return [...set].sort();
  }, [expenses]);

  const filtered = useMemo(() => {
    return expenses
      .filter((e) => {
        if (filterCategory && e.category !== filterCategory) return false;
        if (filterFrom && e.date < filterFrom) return false;
        if (filterTo && e.date > filterTo) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.createdAt.localeCompare(b.createdAt);
      });
  }, [expenses, filterCategory, filterFrom, filterTo]);

  const total = useMemo(
    () => filtered.reduce((s, e) => s + e.amount, 0),
    [filtered],
  );

  const chartGroups = useMemo(() => {
    const map = new Map<
      string,
      { value: number; subs: Map<string, number> }
    >();
    for (const e of filtered) {
      const slot = map.get(e.category) ?? {
        value: 0,
        subs: new Map<string, number>(),
      };
      slot.value += e.amount;
      const subKey = e.subcategory ?? "—";
      slot.subs.set(subKey, (slot.subs.get(subKey) ?? 0) + e.amount);
      map.set(e.category, slot);
    }
    return [...map.entries()]
      .sort((a, b) => b[1].value - a[1].value)
      .map(([key, val]) => ({
        key,
        label: key,
        value: val.value,
        children: [...val.subs.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([sk, sv]) => ({ key: `${key}|${sk}`, label: sk, value: sv })),
      }));
  }, [filtered]);

  function handleImportClick() {
    fileRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportMessage("Загружаю файл…");
    try {
      const text = await file.text();
      const result = parseExpensesCsv(text);
      if (result.rows.length === 0) {
        setImportMessage(
          "Не нашёл строк для импорта. " +
            (result.warnings.join(" ") || "Проверь формат файла."),
        );
        return;
      }
      onAddBulk(result.rows);
      const warn = result.warnings.length
        ? ` Предупреждения: ${result.warnings.join("; ")}`
        : "";
      setImportMessage(`Импортировал ${result.rows.length} строк.${warn}`);
    } catch (err) {
      setImportMessage(
        `Ошибка чтения файла: ${err instanceof Error ? err.message : "?"}`,
      );
    }
  }

  function clearFilters() {
    setFilterCategory("");
    setFilterFrom("");
    setFilterTo("");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Финансы
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Расходы по категориям с диаграммой и фильтрами
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv,application/vnd.ms-excel"
            className="hidden"
            onChange={handleFileSelected}
          />
          <button
            type="button"
            onClick={handleImportClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 11V3M5 6l3-3 3 3M3 13h10" />
            </svg>
            Импорт CSV
          </button>
        </div>
      </div>

      {importMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-200">
          {importMessage}
          <button
            type="button"
            onClick={() => setImportMessage(null)}
            className="ml-2 underline-offset-2 hover:underline"
          >
            закрыть
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1fr] lg:items-start">
        <ExpenseChart groups={chartGroups} formatValue={(n) => RUB.format(n)} />

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <h3 className="mb-3 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Добавить расход
          </h3>
          <NewExpenseForm
            categories={categories}
            onSubmit={(e) => onAdd(e)}
            generateId={generateId}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <h3 className="mr-auto text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Расходы — {filtered.length} {declineRows(filtered.length)}
          </h3>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          >
            <option value="">Все категории</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
          <span className="text-xs text-zinc-400 dark:text-zinc-600">—</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
          {(filterCategory || filterFrom || filterTo) && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-zinc-500 underline-offset-2 transition hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              сбросить
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-600">
            {expenses.length === 0
              ? "Пусто. Добавь первый расход или импортируй CSV."
              : "Под фильтр ничего не попало."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-2">Дата</th>
                  <th className="px-4 py-2">Категория</th>
                  <th className="px-4 py-2">Подкатегория</th>
                  <th className="px-4 py-2">Описание</th>
                  <th className="px-4 py-2 text-right">Сумма</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) =>
                  editingId === e.id ? (
                    <ExpenseEditRow
                      key={e.id}
                      expense={e}
                      categories={categories}
                      onSave={(patch) => {
                        onUpdate(e.id, patch);
                        setEditingId(null);
                      }}
                      onDelete={() => {
                        onDelete(e.id);
                        setEditingId(null);
                      }}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <ExpenseRow
                      key={e.id}
                      expense={e}
                      onEdit={() => setEditingId(e.id)}
                    />
                  ),
                )}
              </tbody>
              <tfoot className="bg-zinc-50 font-medium text-zinc-900 dark:bg-zinc-900 dark:text-zinc-50">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Итого
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-base tabular-nums">
                    {RUB.format(total)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NewExpenseForm({
  categories,
  onSubmit,
  generateId,
}: {
  categories: string[];
  onSubmit: (e: Expense) => void;
  generateId: () => string;
}) {
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const cat = category.trim();
    const amt = parseFloat(amount.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!cat || !Number.isFinite(amt) || amt <= 0) return;
    onSubmit({
      id: generateId(),
      date,
      category: cat,
      subcategory: subcategory.trim() || undefined,
      description: description.trim() || undefined,
      amount: amt,
      createdAt: new Date().toISOString(),
    });
    setSubcategory("");
    setDescription("");
    setAmount("");
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Дата
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            Сумма ₽
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100000"
            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
          />
        </div>
      </div>
      <div>
        <label className="mb-0.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          Категория
        </label>
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="expense-categories"
          placeholder="Дом, Земля…"
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
        <datalist id="expense-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className="mb-0.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          Подкатегория <span className="text-zinc-400">(необязательно)</span>
        </label>
        <input
          type="text"
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          placeholder="Окна, Кирпич…"
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </div>
      <div>
        <label className="mb-0.5 block text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          Описание <span className="text-zinc-400">(необязательно)</span>
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="детали"
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </div>
      <button
        type="submit"
        disabled={!category.trim() || !amount}
        className="w-full rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Добавить
      </button>
    </form>
  );
}

function ExpenseRow({
  expense,
  onEdit,
}: {
  expense: Expense;
  onEdit: () => void;
}) {
  return (
    <tr className="group border-t border-zinc-100 transition hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-900">
      <td className="px-4 py-2.5 font-mono text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
        {formatDate(expense.date)}
      </td>
      <td className="px-4 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {expense.category}
      </td>
      <td className="px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400">
        {expense.subcategory ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-400">
        {expense.description ?? "—"}
      </td>
      <td className="px-4 py-2.5 text-right font-mono text-sm tabular-nums text-zinc-900 dark:text-zinc-50">
        {RUB.format(expense.amount)}
      </td>
      <td className="px-3 py-2.5 text-right">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Редактировать"
          className="rounded-md p-1 text-zinc-400 opacity-0 transition hover:bg-zinc-200 hover:text-zinc-900 group-hover:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 2l3 3-9 9H2v-3z" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

function ExpenseEditRow({
  expense,
  categories,
  onSave,
  onDelete,
  onCancel,
}: {
  expense: Expense;
  categories: string[];
  onSave: (patch: Partial<Expense>) => void;
  onDelete: () => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(expense.date);
  const [category, setCategory] = useState(expense.category);
  const [subcategory, setSubcategory] = useState(expense.subcategory ?? "");
  const [description, setDescription] = useState(expense.description ?? "");
  const [amount, setAmount] = useState(String(expense.amount));

  function save() {
    const cat = category.trim();
    const amt = parseFloat(amount.replace(/[^\d.,]/g, "").replace(",", "."));
    if (!cat || !Number.isFinite(amt) || amt <= 0) return;
    onSave({
      date,
      category: cat,
      subcategory: subcategory.trim() || undefined,
      description: description.trim() || undefined,
      amount: amt,
    });
  }

  return (
    <tr className="border-t border-zinc-100 bg-zinc-50 dark:border-zinc-800/60 dark:bg-zinc-900">
      <td className="px-3 py-2 align-top">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="text"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          list="expense-categories"
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
        <datalist id="expense-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="text"
          value={subcategory}
          onChange={(e) => setSubcategory(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </td>
      <td className="px-3 py-2 align-top">
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-right text-xs tabular-nums text-zinc-900 outline-none focus:border-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-50"
        />
      </td>
      <td className="px-2 py-2 align-top">
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white transition hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            OK
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-2 py-0.5 text-[11px] text-zinc-600 transition hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ×
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md px-2 py-0.5 text-[11px] text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
          >
            🗑
          </button>
        </div>
      </td>
    </tr>
  );
}

function declineRows(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "запись";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "записи";
  return "записей";
}
