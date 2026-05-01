"use client";

type Props = {
  isHigh: boolean;
  onToggle: () => void;
  className?: string;
};

export default function PriorityFlag({ isHigh, onToggle, className = "" }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={isHigh ? "Снять флаг важности" : "Отметить важной"}
      title={isHigh ? "Важная" : "Отметить важной"}
      className={[
        "flex-none rounded-md p-1 transition",
        isHigh
          ? "text-red-500 opacity-100 hover:bg-red-100 dark:hover:bg-red-950/40"
          : "text-zinc-300 opacity-0 hover:bg-zinc-200 hover:text-zinc-600 group-hover:opacity-100 dark:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300",
        className,
      ].join(" ")}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" fill={isHigh ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v12M3 3h8l-1.5 3L11 9H3" />
      </svg>
    </button>
  );
}
