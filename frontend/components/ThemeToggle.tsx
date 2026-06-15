"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { useThemeStore, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; icon: typeof Sun; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
];

/**
 * Theme switcher for the sidebar footer. Expanded: a 3-way Light/Dark/System
 * segmented control. Collapsed: a single button that cycles through them.
 */
export function ThemeToggle({ collapsed }: { collapsed: boolean }) {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  if (collapsed) {
    const idx = OPTIONS.findIndex((o) => o.value === theme);
    const current = OPTIONS[idx === -1 ? 2 : idx];
    const next = OPTIONS[(idx + 1) % OPTIONS.length];
    const Icon = current.icon;
    return (
      <button
        onClick={() => setTheme(next.value)}
        title={`Theme: ${current.label} (click for ${next.label})`}
        className="flex w-full justify-center rounded-lg py-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
      >
        <Icon className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-lg bg-slate-800/60 p-1">
      {OPTIONS.map(({ value, icon: Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            title={label}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
              active ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
