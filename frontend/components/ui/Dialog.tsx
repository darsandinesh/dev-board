"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/cn";

/** Centered modal shell with backdrop + header. Used for create/confirm dialogs. */
export function Dialog({
  title,
  onClose,
  children,
  className,
}: {
  title?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 sm:p-10"
      onClick={onClose}
    >
      <div
        className={cn("w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl", className)}
        onClick={(e) => e.stopPropagation()}
      >
        {title !== undefined && (
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
