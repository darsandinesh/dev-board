"use client";

import { cn } from "@/lib/cn";

export interface Tab {
  value: string;
  label: string;
}

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Tab[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 border-b", className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "-mb-px border-b-2 px-3 py-1.5 text-sm font-medium capitalize transition",
            value === t.value
              ? "border-indigo-600 text-indigo-700 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
