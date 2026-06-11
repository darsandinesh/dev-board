"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Board } from "@/components/Board";
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{project?.name ?? "Project"}</h1>
          {project?.description && (
            <p className="text-sm text-slate-500">{project.description}</p>
          )}
        </div>
        <Protected allowed={perms?.is_owner}>
          <Link
            href={`/projects/${id}/settings`}
            className="rounded bg-slate-200 px-3 py-1 text-sm hover:bg-slate-300"
          >
            Settings
          </Link>
        </Protected>
      </div>

      <Protected allowed={perms?.can_edit}>
        <form
          className="mb-4 flex gap-2"
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
            placeholder="New task title…"
            className="flex-1 rounded border px-3 py-2 text-sm"
          />
          <button className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
            + Task
          </button>
        </form>
      </Protected>

      {isLoading ? (
        <p className="text-slate-500">Loading tasks…</p>
      ) : (
        <Board
          tasks={tasks ?? []}
          canEdit={!!perms?.can_edit}
          onMove={move}
        />
      )}
      {!perms?.can_edit && (
        <p className="mt-4 text-xs text-slate-400">
          Read-only — you have viewer access to this board.
        </p>
      )}
    </div>
  );
}
