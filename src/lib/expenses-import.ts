"use client";

import type { Expense } from "@/types/expense";
import { generateId } from "./storage";

const RU_MONTH_TO_NUM: Record<string, number> = {
  "январ": 1, "янв": 1,
  "феврал": 2, "фев": 2,
  "март": 3, "мар": 3,
  "апрел": 4, "апр": 4,
  "ма": 5, "май": 5,
  "июн": 6,
  "июл": 7,
  "август": 8, "авг": 8,
  "сентябр": 9, "сен": 9,
  "октябр": 10, "окт": 10,
  "ноябр": 11, "ноя": 11,
  "декабр": 12, "дек": 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Parses a single date piece like "27.март", "10.04", "10.04.2026" → "YYYY-MM-DD".
// Returns null if cannot parse.
export function parseSingleDate(input: string, defaultYear: number): string | null {
  const t = input.trim();
  if (!t) return null;

  // dd.mm.yyyy
  const isoLike = t.match(/^(\d{1,2})[.\-/](\d{1,2})(?:[.\-/](\d{2,4}))?$/);
  if (isoLike) {
    const day = parseInt(isoLike[1], 10);
    const month = parseInt(isoLike[2], 10);
    let year = isoLike[3] ? parseInt(isoLike[3], 10) : defaultYear;
    if (year < 100) year += 2000;
    if (day < 1 || day > 31 || month < 1 || month > 12) return null;
    return `${year}-${pad(month)}-${pad(day)}`;
  }

  // dd.{russian month}
  const ruMonth = t.match(/^(\d{1,2})\.([а-яА-ЯёЁ]+)$/);
  if (ruMonth) {
    const day = parseInt(ruMonth[1], 10);
    const word = ruMonth[2].toLowerCase();
    let month: number | undefined;
    for (const [prefix, num] of Object.entries(RU_MONTH_TO_NUM)) {
      if (word.startsWith(prefix)) {
        month = num;
        break;
      }
    }
    if (!month || day < 1 || day > 31) return null;
    return `${defaultYear}-${pad(month)}-${pad(day)}`;
  }

  return null;
}

// Parses a "date cell" that may contain one date or two dates with parentheses
// like "10.04.(22.04)" → ["2026-04-10", "2026-04-22"].
export function parseDateCell(input: string, defaultYear: number): string[] {
  const cleaned = input.trim().replace(/\s+/g, "");
  if (!cleaned) return [];

  // Format: "10.04.(22.04)" or "10.04(22.04)" — split on parenthesis.
  const parenMatch = cleaned.match(/^(.+?)\.?\(([^)]+)\)$/);
  if (parenMatch) {
    const first = parseSingleDate(parenMatch[1], defaultYear);
    const second = parseSingleDate(parenMatch[2], defaultYear);
    return [first, second].filter((d): d is string => !!d);
  }

  const single = parseSingleDate(cleaned, defaultYear);
  return single ? [single] : [];
}

function parseAmount(input: string): number {
  const cleaned = input.replace(/[^\d.,]/g, "").replace(/\s/g, "");
  // Russian decimals can use comma; for our case all are integers.
  const normalized = cleaned.replace(/,/g, ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

export type ImportResult = {
  rows: Expense[];
  warnings: string[];
};

// Parses Russian Excel-exported CSV (semicolon-separated, BOM, possibly cyrillic month dates).
// Splits parenthesised dates into separate rows with amount halved.
export function parseExpensesCsv(text: string, defaultYear = 2026): ImportResult {
  const warnings: string[] = [];
  // Strip UTF-8 BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/);
  if (lines.length < 2) return { rows: [], warnings: ["Файл пустой или нет данных"] };

  // Detect separator
  const firstLine = lines[0];
  const sep = firstLine.includes(";") ? ";" : ",";

  const header = firstLine.split(sep).map((h) => h.trim().toLowerCase());

  // Find column indexes by Russian header names
  function findCol(...names: string[]): number {
    for (const n of names) {
      const idx = header.findIndex((h) => h.includes(n));
      if (idx >= 0) return idx;
    }
    return -1;
  }

  const idxDate = findCol("дата");
  const idxCategory = findCol("категори");
  const idxSubcategory = findCol("подкатегор");
  const idxDesc = findCol("описан", "коммент");
  const idxAmount = findCol("сумма");

  if (idxDate < 0 || idxCategory < 0 || idxAmount < 0) {
    warnings.push(
      "Не нашёл обязательные колонки. Нужны: «Дата», «Категория», «Сумма».",
    );
    return { rows: [], warnings };
  }

  const rows: Expense[] = [];
  const createdAt = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = line.split(sep).map((c) => c.trim());
    const dateCell = cells[idxDate] ?? "";
    const category = cells[idxCategory] ?? "";
    if (!dateCell || !category) continue; // skip totals/empty rows

    const subcategory = idxSubcategory >= 0 ? cells[idxSubcategory] ?? "" : "";
    const description = idxDesc >= 0 ? cells[idxDesc] ?? "" : "";
    const amount = parseAmount(cells[idxAmount] ?? "0");
    if (amount <= 0) continue;

    const dates = parseDateCell(dateCell, defaultYear);
    if (dates.length === 0) {
      warnings.push(`Не разобрал дату в строке ${i + 1}: «${dateCell}»`);
      continue;
    }

    if (dates.length === 1) {
      rows.push({
        id: generateId(),
        date: dates[0],
        category,
        subcategory: subcategory || undefined,
        description: description || undefined,
        amount,
        createdAt,
      });
    } else {
      // Split into N rows with amount divided equally
      const part = Math.round((amount / dates.length) * 100) / 100;
      const remainder = Math.round((amount - part * (dates.length - 1)) * 100) / 100;
      dates.forEach((d, idx) => {
        const isLast = idx === dates.length - 1;
        rows.push({
          id: generateId(),
          date: d,
          category,
          subcategory: subcategory || undefined,
          description:
            (description ? description + " " : "") + `(часть ${idx + 1})`,
          amount: isLast ? remainder : part,
          createdAt,
        });
      });
    }
  }

  return { rows, warnings };
}

// Pre-baked seed for the user's existing house construction expenses (for first-time setup).
export function seedHouseExpenses(): Expense[] {
  const createdAt = new Date().toISOString();
  return [
    { id: generateId(), date: "2026-03-27", category: "Дом",     subcategory: "Проект",     description: undefined,                amount: 200000,  createdAt },
    { id: generateId(), date: "2026-03-27", category: "Дом",     subcategory: "Дом",        description: "предоплата",             amount: 100000,  createdAt },
    { id: generateId(), date: "2026-04-02", category: "Земля",   subcategory: "Участок",    description: "покупка",                amount: 5437350, createdAt },
    { id: generateId(), date: "2026-04-10", category: "Земля",   subcategory: "Участок 2",  description: "покупка",                amount: 5437350, createdAt },
    { id: generateId(), date: "2026-04-10", category: "Земля",   subcategory: "участок 1",  description: "чистка (часть 1)",       amount: 150000,  createdAt },
    { id: generateId(), date: "2026-04-22", category: "Земля",   subcategory: "участок 1",  description: "чистка (часть 2)",       amount: 150000,  createdAt },
    { id: generateId(), date: "2026-04-25", category: "Подъездная дорога", subcategory: undefined, description: undefined,         amount: 365100,  createdAt },
  ];
}
