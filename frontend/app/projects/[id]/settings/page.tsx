"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { MemberTable } from "@/components/MemberTable";
import { usePermissions, useProject } from "@/lib/api";

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useProject(id);
  const { data: perms, isLoading } = usePermissions(`project:${id}`);

  if (isLoading) return <p className="text-slate-500">Loading…</p>;

  // Only owners manage membership; viewers/editors get a read-only table.
  if (!perms?.can_view) {
    return <p className="text-red-600">You don’t have access to this project.</p>;
  }

  return (
    <div>
      <div className="mb-4">
        <Link href={`/projects/${id}`} className="text-sm text-blue-600 hover:underline">
          ← Back to board
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{project?.name} — Members</h1>
        {!perms?.is_owner && (
          <p className="text-xs text-slate-400">
            Read-only — only the owner can change roles.
          </p>
        )}
      </div>
      <MemberTable projectId={id} canManage={!!perms?.is_owner} />
    </div>
  );
}
