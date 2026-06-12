"use client";

import { SquareKanban } from "lucide-react";
import { signIn, useSession } from "next-auth/react";
import type { ReactNode } from "react";

import { Avatar } from "./Avatar";
import { Loader } from "./Loader";
import { NotificationBell } from "./NotificationBell";
import { ProjectSwitcher } from "./ProjectSwitcher";
import { Sidebar } from "./Sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader size={44} />
      </div>
    );
  }

  // Unauthenticated → full-screen sign-in.
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm">
          <SquareKanban className="mx-auto h-10 w-10 text-indigo-600" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">DevBoard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Multi-tenant task management with relationship-based access control.
          </p>
          <button
            onClick={() => signIn("keycloak")}
            className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white transition hover:bg-indigo-700"
          >
            Sign in with Keycloak
          </button>
        </div>
      </div>
    );
  }

  const name = session.user?.name || session.user?.email || "User";

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-white px-6">
          <ProjectSwitcher />
          <div className="flex flex-1 items-center justify-end gap-3">
            <NotificationBell />
            <Avatar name={name} size={28} />
            <span className="text-sm font-medium text-slate-700">{name}</span>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-6xl animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
