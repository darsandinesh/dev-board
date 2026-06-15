"use client";

import { Search, SquareKanban } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState, type ReactNode } from "react";

import { Avatar } from "./Avatar";
import { Breadcrumbs } from "./Breadcrumbs";
import { CommandPalette } from "./CommandPalette";
import { DemoCredentials } from "./DemoCredentials";
import { Loader } from "./Loader";
import { NotificationBell } from "./NotificationBell";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Global ⌘K / Ctrl+K to open the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader size={44} />
      </div>
    );
  }

  // Unauthenticated (or a session whose token refresh failed) → show our own
  // sign-in screen rather than letting an expired token bounce to Keycloak.
  if (!session || session.error) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm dark:bg-slate-900">
          <SquareKanban className="mx-auto h-10 w-10 text-indigo-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">DevBoard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Multi-tenant task management with relationship-based access control.
          </p>
          <button
            onClick={() => signIn("keycloak")}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700"
          >
            Sign in with Keycloak
          </button>
          <DemoCredentials />
        </div>
      </div>
    );
  }

  const name = session.user?.name || session.user?.email || "User";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-6 dark:bg-slate-900">
          <Breadcrumbs />
          <div className="flex flex-1 items-center justify-end gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-1.5 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-300"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Search…</span>
              <kbd className="hidden rounded border bg-white px-1.5 text-[10px] dark:bg-slate-900 sm:inline">
                ⌘K
              </kbd>
            </button>
            <NotificationBell />
            <Avatar name={name} size={28} />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{name}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="animate-fade-in mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
