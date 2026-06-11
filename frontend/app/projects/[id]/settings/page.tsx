"use client";

import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { AddMemberSearch } from "@/components/AddMemberSearch";
import { ErrorState } from "@/components/ErrorState";
import { LoaderScreen } from "@/components/Loader";
import { MemberTable } from "@/components/MemberTable";
import {
  useAddProjectMember,
  usePermissions,
  useProject,
  useProjectMembers,
} from "@/lib/api";

const PROJECT_ROLES = ["owner", "editor", "viewer"];

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useProject(id);
  const { data: perms, isLoading } = usePermissions(`project:${id}`);
  const { data: members } = useProjectMembers(id);
  const addMember = useAddProjectMember(id);

  if (isLoading) return <LoaderScreen message="Loading project" />;

  if (!perms?.can_view) {
    return (
      <ErrorState
        code="403"
        title="No access to this project"
        message="You’re not a member of this project, so its settings aren’t available."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/projects/${id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Back to board
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">
          {project?.name} · Settings
        </h1>
      </div>

      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Users className="h-5 w-5 text-indigo-600" /> Members
        </h2>
        {perms?.is_owner ? (
          <p className="mt-1 text-sm text-slate-500">
            Add people to this project. They’ll only see it once added (projects
            are private).
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Read-only — only the project owner can manage members.
          </p>
        )}

        {perms?.is_owner && (
          <div className="mt-4">
            <AddMemberSearch
              roles={PROJECT_ROLES}
              excludeIds={(members ?? []).map((m) => m.user_id)}
              pending={addMember.isPending}
              onAdd={(userId, role) => addMember.mutate({ userId, role })}
            />
          </div>
        )}

        <div className="mt-5">
          <MemberTable projectId={id} canManage={!!perms?.is_owner} />
        </div>
      </section>
    </div>
  );
}
