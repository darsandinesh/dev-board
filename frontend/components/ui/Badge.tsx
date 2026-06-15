import { cn } from "@/lib/cn";

type Tone = "slate" | "indigo" | "emerald" | "amber" | "red" | "blue" | "violet";

const TONE: Record<Tone, string> = {
  slate: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  indigo: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  red: "bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  violet: "bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
};

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Semantic tone maps reused across the app.
export const STATUS_TONE: Record<string, Tone> = {
  todo: "slate",
  in_progress: "blue",
  done: "emerald",
};
export const ROLE_TONE: Record<string, Tone> = {
  admin: "indigo",
  owner: "indigo",
  editor: "emerald",
  member: "slate",
  viewer: "slate",
};
export const PRIORITY_TONE: Record<string, Tone> = {
  urgent: "red",
  high: "amber",
  medium: "amber",
  low: "slate",
};
