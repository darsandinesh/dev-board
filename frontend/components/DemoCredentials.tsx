"use client";

import { Check, Copy, KeyRound, Sparkles } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";

const PASSWORD = "password123";
const USERS = [
  { username: "alice", role: "Platform admin", platform: true },
  { username: "bob", role: "User" },
  { username: "carol", role: "User" },
  { username: "dave", role: "User" },
];

/** A small, collapsible "demo accounts" helper for the sign-in screen. */
export function DemoCredentials() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (username: string) => {
    navigator.clipboard?.writeText(`${username} / ${PASSWORD}`);
    setCopied(username);
    setTimeout(() => setCopied((c) => (c === username ? null : c)), 1500);
  };

  return (
    <div className="mt-4 text-left">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700"
      >
        <KeyRound className="h-3.5 w-3.5" />
        {open ? "Hide demo accounts" : "Show demo accounts"}
      </button>

      {open && (
        <div className="mt-3 space-y-2 rounded-xl border bg-slate-50 p-3">
          <p className="text-center text-[11px] text-slate-400">
            All passwords are <span className="font-mono">{PASSWORD}</span> · click to copy
          </p>
          <ul className="space-y-1.5">
            {USERS.map((u) => (
              <li key={u.username}>
                <button
                  onClick={() => copy(u.username)}
                  className="flex w-full items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-left text-sm transition hover:border-indigo-300"
                  title="Copy username / password"
                >
                  <Avatar name={u.username} size={26} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1 font-medium text-slate-700">
                      {u.username}
                      {u.platform && <Sparkles className="h-3 w-3 text-amber-500" />}
                    </div>
                    <div className="text-[11px] text-slate-400">{u.role}</div>
                  </div>
                  {copied === u.username ? (
                    <Check className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-slate-300" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
