"use client";

import { useMemo, useState } from "react";

type Slice = {
  key: string;
  label: string;
  value: number;
};

type Props = {
  // Top-level groups; each can have nested children (subcategories)
  groups: Array<{ key: string; label: string; value: number; children?: Slice[] }>;
  formatValue: (n: number) => string;
  title?: string;
};

const PALETTE = [
  "#2563eb", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#06b6d4", // cyan
  "#ec4899", // fuchsia
  "#84cc16", // lime
  "#f97316", // orange
  "#6366f1", // indigo
];

function colorAt(i: number): string {
  return PALETTE[i % PALETTE.length];
}

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): string {
  const start = polar(cx, cy, r, startDeg);
  const end = polar(cx, cy, r, endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  // Full circle case
  if (Math.abs(endDeg - startDeg - 360) < 0.01) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy}`;
  }
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
}

export default function ExpenseChart({ groups, formatValue, title = "По категориям" }: Props) {
  const [drillKey, setDrillKey] = useState<string | null>(null);

  const total = useMemo(
    () => groups.reduce((sum, g) => sum + g.value, 0),
    [groups],
  );

  const drillGroup =
    drillKey ? groups.find((g) => g.key === drillKey) : null;

  const slices: Slice[] = drillGroup
    ? drillGroup.children ?? []
    : groups.map((g) => ({ key: g.key, label: g.label, value: g.value }));

  const slicesTotal = slices.reduce((s, x) => s + x.value, 0);

  if (total === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-center text-sm text-zinc-400 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600">
        Пока нет данных для диаграммы.
      </div>
    );
  }

  const cx = 110;
  const cy = 110;
  const r = 100;

  let cursor = 0;
  const arcs = slices.map((s, i) => {
    const fraction = slicesTotal > 0 ? s.value / slicesTotal : 0;
    const start = cursor;
    const end = cursor + fraction * 360;
    cursor = end;
    return {
      slice: s,
      color: colorAt(i),
      d: arcPath(cx, cy, r, start, end),
      fraction,
    };
  });

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          {drillGroup ? `${drillGroup.label} — детализация` : title}
        </h2>
        {drillGroup && (
          <button
            type="button"
            onClick={() => setDrillKey(null)}
            className="rounded-md px-2 py-1 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
          >
            ← назад
          </button>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative">
          <svg viewBox="0 0 220 220" className="h-56 w-56">
            {arcs.map(({ slice, color, d, fraction }) => (
              <path
                key={slice.key}
                d={d}
                fill={color}
                className={[
                  "transition",
                  !drillGroup &&
                  groups.find((g) => g.key === slice.key)?.children?.length
                    ? "cursor-pointer hover:opacity-80"
                    : "",
                ].join(" ")}
                onClick={() => {
                  if (drillGroup) return;
                  const g = groups.find((g) => g.key === slice.key);
                  if (g?.children?.length) setDrillKey(slice.key);
                }}
              >
                <title>
                  {slice.label}: {formatValue(slice.value)} (
                  {Math.round(fraction * 100)}%)
                </title>
              </path>
            ))}
            <circle cx={cx} cy={cy} r={45} fill="white" className="dark:fill-zinc-950" />
            <text
              x={cx}
              y={cy - 4}
              textAnchor="middle"
              className="fill-zinc-500 text-[9px] dark:fill-zinc-400"
            >
              Итого
            </text>
            <text
              x={cx}
              y={cy + 12}
              textAnchor="middle"
              className="fill-zinc-900 text-[12px] font-semibold tabular-nums dark:fill-zinc-50"
            >
              {formatValue(slicesTotal)}
            </text>
          </svg>
        </div>

        <ul className="flex-1 space-y-1.5">
          {arcs.map(({ slice, color, fraction }) => {
            const hasChildren =
              !drillGroup &&
              !!groups.find((g) => g.key === slice.key)?.children?.length;
            return (
              <li key={slice.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (drillGroup) return;
                    if (hasChildren) setDrillKey(slice.key);
                  }}
                  disabled={!hasChildren && !drillGroup}
                  className={[
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition",
                    hasChildren
                      ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                      : "cursor-default",
                  ].join(" ")}
                >
                  <span
                    className="h-3 w-3 flex-none rounded-sm"
                    style={{ backgroundColor: color }}
                  />
                  <span className="flex-1 truncate text-sm text-zinc-900 dark:text-zinc-100">
                    {slice.label}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                    {formatValue(slice.value)}
                  </span>
                  <span className="w-10 flex-none text-right text-[10px] text-zinc-400 dark:text-zinc-600">
                    {Math.round(fraction * 100)}%
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
