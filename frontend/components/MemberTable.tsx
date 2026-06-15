"use client";

import { Trash2 } from "lucide-react";

import { Avatar } from "@/components/Avatar";
import { Loader } from "@/components/Loader";
import { Select } from "@/components/Select";
import { useMe, useProjectMembers, useRemoveProjectMember, useUpdateMemberRole } from "@/lib/api";
import { roleLabel } from "@/lib/roles";

const ROLES = ["owner", "editor", "viewer"];

export function MemberTable({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const { data: me } = useMe();
  const { data: members, isLoading } = useProjectMembers(projectId);
  const updateRole = useUpdateMemberRole(projectId);
  const removeMember = useRemoveProjectMember(projectId);

  if (isLoading)
    return (
      <div className="flex justify-center py-6">
        <Loader size={28} />
      </div>
    );

  return (
    <ul className="divide-y">
      {members?.map((m) => {
        const isSelf = m.user_id === me?.id;
        return (
          <li key={m.user_id} className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Avatar name={m.username} size={32} />
              <span className="font-medium text-slate-700">
                {m.username}
                {isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}
              </span>
            </div>
            {canManage ? (
              <div className="flex items-center gap-2">
                <Select
                  value={m.role}
                  disabled={isSelf}
                  onChange={(role) => updateRole.mutate({ userId: m.user_id, role })}
                  options={ROLES.map((r) => ({ value: r, label: roleLabel(r) }))}
                />
                {!isSelf && (
                  <button
                    onClick={() => removeMember.mutate(m.user_id)}
                    title="Remove from project"
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                {roleLabel(m.role)}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
