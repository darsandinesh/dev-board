import { Ban, FileQuestion, Lock, ServerCrash, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

const ICONS: Record<string, LucideIcon> = {
  "403": Ban,
  "404": FileQuestion,
  "500": ServerCrash,
  default: Lock,
};

export function ErrorState({
  code,
  title,
  message,
  action,
}: {
  code: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  const Icon = ICONS[code] ?? ICONS.default;
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
        <Icon className="h-8 w-8" />
      </div>
      <div className="mt-4 text-5xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        {code}
      </div>
      <h1 className="mt-2 text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
      <div className="mt-6 flex gap-3">
        {action ?? (
          <Link
            href="/"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Back to projects
          </Link>
        )}
      </div>
    </div>
  );
}
