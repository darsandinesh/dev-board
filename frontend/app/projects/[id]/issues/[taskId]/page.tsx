"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ErrorState } from "@/components/ErrorState";
import { IssueView } from "@/components/IssueView";
import { LoaderScreen } from "@/components/Loader";
import { usePermissions } from "@/lib/api";

export default function IssuePage() {
  const { id, taskId } = useParams<{ id: string; taskId: string }>();
  // Access is governed by the parent project (private projects).
  const { data: perms, isLoading } = usePermissions(`project:${id}`);

  if (isLoading) return <LoaderScreen message="Loading issue" />;
  if (!perms?.can_view) {
    return (
      <ErrorState
        code="403"
        title="No access to this issue"
        message="You’re not a member of this project."
      />
    );
  }

  return (
    <div className="space-y-4">
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to board
      </Link>
      <IssueView projectId={id} taskId={taskId} canEdit={!!perms?.can_edit} />
    </div>
  );
}
