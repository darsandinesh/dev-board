"use client";

import { Bell } from "lucide-react";
import { useState } from "react";

import { useMarkAllRead, useNotifications } from "@/lib/api";

export function NotificationBell() {
  const { data: notes } = useNotifications();
  const markAll = useMarkAllRead();
  const [open, setOpen] = useState(false);

  const unread = (notes ?? []).filter((n) => !n.is_read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border bg-white shadow-lg">
            <div className="flex items-center justify-between border-b px-4 py-2">
              <span className="text-sm font-semibold text-slate-700">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-96 divide-y overflow-y-auto">
              {(notes ?? []).length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-slate-400">
                  You’re all caught up.
                </li>
              ) : (
                (notes ?? []).map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-2.5 text-sm ${n.is_read ? "" : "bg-indigo-50/50"}`}
                  >
                    <div className="text-slate-700">{n.message}</div>
                    <div className="mt-0.5 text-xs text-slate-400">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
