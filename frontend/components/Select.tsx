"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface Option {
  value: string;
  label: string;
}

/**
 * Custom dropdown used app-wide instead of the native <select>.
 * The menu renders in a portal (fixed position) so it's never clipped by
 * scrollable/overflow-hidden parents like modals or the issue sidebar.
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);

  const toggle = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    setRect(btnRef.current?.getBoundingClientRect() ?? null);
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        disabled={disabled}
        onClick={toggle}
        className={`flex items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 disabled:cursor-default disabled:bg-slate-50 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:disabled:bg-slate-800/50 ${className}`}
      >
        <span className={`truncate ${selected ? "" : "text-slate-400 dark:text-slate-500"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {mounted &&
        open &&
        rect &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
            <ul
              className="fixed z-[71] max-h-64 overflow-auto rounded-lg border bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
              style={{
                top: rect.bottom + 4,
                left: rect.left,
                minWidth: Math.max(rect.width, 140),
              }}
            >
              {options.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-700 ${
                      o.value === value
                        ? "font-medium text-indigo-700 dark:text-indigo-400"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    <span className="truncate">{o.label}</span>
                    {o.value === value && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                  </button>
                </li>
              ))}
            </ul>
          </>,
          document.body,
        )}
    </>
  );
}
