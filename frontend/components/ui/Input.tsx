import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

const base =
  "w-full rounded-lg border px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(base, className)} {...props} />;
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <label
      className={cn(
        "mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400",
        className,
      )}
    >
      {children}
    </label>
  );
}
