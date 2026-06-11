"use client";

import { Avatar } from "@/components/Avatar";
import { useProjectMembers, useUpdateMemberRole } from "@/lib/api";

const ROLES = ["owner", "editor", "viewer"];

export function MemberTable({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  const { data: members, isLoading } = useProjectMembers(projectId);
  const updateRole = useUpdateMemberRole(projectId);

  if (isLoading) return <p className="text-slate-500">Loading members…</p>;

  return (
    <ul className="divide-y">
      {members?.map((m) => (
        <li key={m.user_id} className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Avatar name={m.username} size={32} />
            <span className="font-medium text-slate-700">{m.username}</span>
          </div>
          {canManage ? (
            <select
              value={m.role}
              onChange={(e) =>
                updateRole.mutate({ userId: m.user_id, role: e.target.value })
              }
              className="rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              {m.role}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
