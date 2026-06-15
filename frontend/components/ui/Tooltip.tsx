"use client";

import { useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Lightweight hover/focus tooltip. Wrap any control; pass `label` (the "why").
 * Renders nothing extra when label is empty, so it's safe to use conditionally.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label?: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!label) return <>{children}</>;

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 w-max max-w-xs -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white shadow-lg",
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5",
            className,
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
