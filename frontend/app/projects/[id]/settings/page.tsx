"use client";

import { ArrowLeft, SlidersHorizontal, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { AddMemberSearch } from "@/components/AddMemberSearch";
import { ErrorState } from "@/components/ErrorState";
import { LoaderScreen } from "@/components/Loader";
import { MemberTable } from "@/components/MemberTable";
import {
  useAddProjectMember,
  usePermissions,
  useProject,
  useProjectMembers,
  useUpdateProject,
} from "@/lib/api";

const PROJECT_ROLES = ["owner", "editor", "viewer"];

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useProject(id);
  const { data: perms, isLoading } = usePermissions(`project:${id}`);
  const { data: members } = useProjectMembers(id);
  const addMember = useAddProjectMember(id);
  const updateProject = useUpdateProject(id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  useEffect(() => {
    if (project) {
      setName(project.name);
      setDescription(project.description ?? "");
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const isOwner = !!perms?.is_owner;
  const dirty = project && (name !== project.name || description !== (project.description ?? ""));

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

      {/* Project details */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <SlidersHorizontal className="h-5 w-5 text-indigo-600" /> Project
          {project?.key && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-500">
              {project.key}
            </span>
          )}
        </h2>
        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Name
            </label>
            <input
              value={name}
              disabled={!isOwner}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Description
            </label>
            <textarea
              value={description}
              disabled={!isOwner}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
            />
          </div>
          {isOwner && (
            <button
              disabled={!dirty || updateProject.isPending}
              onClick={() =>
                updateProject.mutate({ name, description: description || null })
              }
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              Save changes
            </button>
          )}
          {!isOwner && (
            <p className="text-xs text-slate-400">
              Read-only — only the project owner (Admin) can edit project details.
            </p>
          )}
        </div>
      </section>

      {/* Members */}
      <section className="rounded-2xl border bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900">
          <Users className="h-5 w-5 text-indigo-600" /> Members
        </h2>
        {isOwner ? (
          <p className="mt-1 text-sm text-slate-500">
            Add people to this project. They’ll only see it once added (projects
            are private).
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400">
            Read-only — only the project owner can manage members.
          </p>
        )}

        {isOwner && (
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
          <MemberTable projectId={id} canManage={isOwner} />
        </div>
      </section>
    </div>
  );
}
