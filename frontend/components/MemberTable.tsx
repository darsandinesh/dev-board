"use client";

import {
  useProjectMembers,
  useUpdateMemberRole,
} from "@/lib/api";

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
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-slate-500">
          <th className="py-2">User</th>
          <th className="py-2">Role</th>
        </tr>
      </thead>
      <tbody>
        {members?.map((m) => (
          <tr key={m.user_id} className="border-b">
            <td className="py-2">{m.username}</td>
            <td className="py-2">
              {canManage ? (
                <select
                  value={m.role}
                  onChange={(e) =>
                    updateRole.mutate({ userId: m.user_id, role: e.target.value })
                  }
                  className="rounded border px-2 py-1"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{m.role}</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
