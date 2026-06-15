"use client";

import { useEffect } from "react";
import { create } from "zustand";

export type Theme = "light" | "dark" | "system";

const KEY = "devboard-theme";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** The concrete light/dark a Theme resolves to right now. */
export function resolveTheme(t: Theme): "light" | "dark" {
  return t === "system" ? (systemPrefersDark() ? "dark" : "light") : t;
}

/** Toggle the `dark` class on <html> to match the given theme. */
export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const dark = resolveTheme(t) === "dark";
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function initialTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    return (window.localStorage.getItem(KEY) as Theme | null) ?? "system";
  } catch {
    return "system";
  }
}

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme(),
  setTheme: (t) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(KEY, t);
      } catch {
        /* storage unavailable (private mode, etc.) — theme still applies */
      }
    }
    applyTheme(t);
    set({ theme: t });
  },
}));

/**
 * Mount once (in Providers): re-applies the stored theme on load and keeps the
 * UI in sync when the OS theme changes while "system" is selected.
 */
export function useThemeEffect() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);
}
