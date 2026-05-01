"use client";

const TAG_STYLES: Record<string, string> = {
  blue: "bg-blue-100 text-blue-800 border-blue-200/60 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/40",
  emerald: "bg-emerald-100 text-emerald-800 border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/40",
  amber: "bg-amber-100 text-amber-800 border-amber-200/60 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/40",
  rose: "bg-rose-100 text-rose-800 border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/40",
  violet: "bg-violet-100 text-violet-800 border-violet-200/60 dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-900/40",
  cyan: "bg-cyan-100 text-cyan-800 border-cyan-200/60 dark:bg-cyan-950/40 dark:text-cyan-200 dark:border-cyan-900/40",
  fuchsia: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200/60 dark:bg-fuchsia-950/40 dark:text-fuchsia-200 dark:border-fuchsia-900/40",
  lime: "bg-lime-100 text-lime-800 border-lime-200/60 dark:bg-lime-950/40 dark:text-lime-200 dark:border-lime-900/40",
};

const TAG_KEYS = Object.keys(TAG_STYLES);

export function tagColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return TAG_STYLES[TAG_KEYS[Math.abs(hash) % TAG_KEYS.length]];
}

type Props = {
  tag: string;
  muted?: boolean;
  onClick?: () => void;
  active?: boolean;
};

export default function TagPill({ tag, muted, onClick, active }: Props) {
  const colorCls = tagColor(tag);
  const base = "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium leading-none transition";
  const interactive = onClick ? "cursor-pointer hover:scale-[1.03]" : "";
  const stateCls = muted
    ? "bg-zinc-100 text-zinc-400 border-zinc-200 dark:bg-zinc-900 dark:text-zinc-600 dark:border-zinc-800 line-through"
    : colorCls;
  const ringCls = active ? "ring-1 ring-zinc-900 dark:ring-zinc-50" : "";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[base, interactive, stateCls, ringCls].join(" ")}
      >
        {tag}
      </button>
    );
  }
  return (
    <span className={[base, stateCls].join(" ")}>{tag}</span>
  );
}
