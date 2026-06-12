"use client";

import {
  AtSign,
  Bell,
  CheckCheck,
  Eye,
  MessageSquare,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  type Notification,
} from "@/lib/api";

const KIND_ICON: Record<string, LucideIcon> = {
  assigned: UserPlus,
  mentioned: AtSign,
  commented: MessageSquare,
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const { data: notes } = useNotifications();
  const markAll = useMarkAllRead();
  const markRead = useMarkRead();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const unread = (notes ?? []).filter((n) => !n.is_read).length;

  const view = (n: Notification) => {
    setOpen(false);
    if (!n.is_read) markRead.mutate(n.id);
    if (n.project_id && n.task_id) {
      router.push(`/projects/${n.project_id}/issues/${n.task_id}`);
    } else if (n.project_id) {
      router.push(`/projects/${n.project_id}`);
    }
  };

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
          <div className="absolute right-0 z-50 mt-2 w-96 overflow-hidden rounded-xl border bg-white shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <span className="text-sm font-semibold text-slate-700">
                Notifications {unread > 0 && <span className="text-indigo-600">· {unread} new</span>}
              </span>
              {unread > 0 && (
                <button
                  onClick={() => markAll.mutate()}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <ul className="max-h-[26rem] divide-y overflow-y-auto">
              {(notes ?? []).length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-slate-400">
                  <Bell className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  You’re all caught up.
                </li>
              ) : (
                (notes ?? []).map((n) => {
                  const Icon = KIND_ICON[n.kind] ?? Bell;
                  return (
                    <li
                      key={n.id}
                      className={`group flex items-start gap-3 px-4 py-3 ${
                        n.is_read ? "" : "bg-indigo-50/40"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                          n.is_read ? "bg-slate-100 text-slate-400" : "bg-indigo-100 text-indigo-600"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-slate-700">{n.message}</div>
                        <div className="mt-0.5 text-xs text-slate-400">{timeAgo(n.created_at)}</div>
                      </div>
                      {n.project_id && (
                        <button
                          onClick={() => view(n)}
                          title="View"
                          className="rounded-lg p-1.5 text-slate-400 opacity-0 transition hover:bg-white hover:text-indigo-600 group-hover:opacity-100"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      )}
                      {!n.is_read && (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
