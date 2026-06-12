"use client";

import { Check, Search, UserPlus } from "lucide-react";
import { useState } from "react";

import { Avatar } from "@/components/Avatar";
import { Select } from "@/components/Select";
import { useUserSearch } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

/**
 * Search existing users by name/email and add the chosen one with a role.
 * Used for both org and project membership.
 */
export function AddMemberSearch({
  roles,
  excludeIds,
  onAdd,
  pending,
}: {
  roles: string[];
  excludeIds: string[];
  onAdd: (userId: string, role: string) => void;
  pending?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [role, setRole] = useState(roles[roles.length - 1]); // least-privileged default
  const { data: results } = useUserSearch(query);

  const candidates = (results ?? []).filter((u) => !excludeIds.includes(u.id));

  return (
    <div className="rounded-xl border bg-slate-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users by name or email…"
            className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
        </div>
        <Select
          value={role}
          onChange={setRole}
          options={roles.map((r) => ({ value: r, label: roleLabel(r) }))}
        />
      </div>

      {query && (
        <ul className="mt-3 max-h-56 divide-y overflow-auto rounded-lg border bg-white">
          {candidates.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-400">No matching users.</li>
          ) : (
            candidates.map((u) => (
              <li key={u.id} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <Avatar name={u.username} size={28} />
                  <div className="leading-tight">
                    <div className="text-sm font-medium text-slate-700">{u.username}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </div>
                </div>
                <button
                  disabled={pending}
                  onClick={() => {
                    onAdd(u.id, role);
                    setQuery("");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
                >
                  <UserPlus className="h-3.5 w-3.5" /> Add as {roleLabel(role)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
