"use client";

import { ArrowLeft, Eye, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Board } from "@/components/Board";
import { LoaderScreen } from "@/components/Loader";
import { Protected } from "@/components/Protected";
import {
  useCreateTask,
  usePermissions,
  useProject,
  useTasks,
  useUpdateTask,
  type TaskStatus,
} from "@/lib/api";

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project } = useProject(id);
  const { data: tasks, isLoading } = useTasks(id);
  const { data: perms } = usePermissions(`project:${id}`);
  const updateTask = useUpdateTask(id);
  const createTask = useCreateTask(id);
  const [title, setTitle] = useState("");

  const move = (taskId: string, status: TaskStatus) =>
    updateTask.mutate({ id: taskId, patch: { status } });

  return (
    <div className="space-y-5">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {project?.name ?? "Project"}
            </h1>
            {project?.description && (
              <p className="text-sm text-slate-500">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!perms?.can_edit && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                <Eye className="h-3.5 w-3.5" /> Read-only
              </span>
            )}
            <Protected allowed={perms?.is_owner}>
              <Link
                href={`/projects/${id}/settings`}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </Protected>
          </div>
        </div>
      </div>

      <Protected allowed={perms?.can_edit}>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            createTask.mutate({ title });
            setTitle("");
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Task
          </button>
        </form>
      </Protected>

      {isLoading ? (
        <LoaderScreen message="Loading tasks" />
      ) : (
        <Board tasks={tasks ?? []} canEdit={!!perms?.can_edit} onMove={move} />
      )}
    </div>
  );
}
