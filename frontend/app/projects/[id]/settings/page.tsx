"use client";

import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { LoaderScreen } from "@/components/Loader";
import { MemberTable } from "@/components/MemberTable";
import { usePermissions, useProject } from "@/lib/api";

export default function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useProject(id);
  const { data: perms, isLoading } = usePermissions(`project:${id}`);

  if (isLoading) return <LoaderScreen message="Loading project" />;

  if (!perms?.can_view) {
    return <p className="text-red-600">You don’t have access to this project.</p>;
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
        {!perms?.is_owner && (
          <p className="mt-1 text-xs text-slate-400">
            Read-only — only the project owner can change roles.
          </p>
        )}
        <div className="mt-4">
          <MemberTable projectId={id} canManage={!!perms?.is_owner} />
        </div>
      </section>
    </div>
  );
}
