"use client";

import { ArrowLeft, Eye, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Backlog } from "@/components/Backlog";
import { Board } from "@/components/Board";
import { Reports } from "@/components/Reports";
import { ErrorState } from "@/components/ErrorState";
import { LoaderScreen } from "@/components/Loader";
import { Protected } from "@/components/Protected";
import {
  useCreateTask,
  usePermissions,
  useProject,
  useProjectMembers,
  useTasks,
  useUpdateTask,
  type TaskStatus,
} from "@/lib/api";

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>();
  const { data: project, error: projectError } = useProject(id);
  const { data: tasks, isLoading } = useTasks(id);
  const { data: perms } = usePermissions(`project:${id}`);
  const updateTask = useUpdateTask(id);
  const createTask = useCreateTask(id);
  const { data: members } = useProjectMembers(id);
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [query, setQuery] = useState("");
  const [typeF, setTypeF] = useState("");
  const [prioF, setPrioF] = useState("");
  const [assigneeF, setAssigneeF] = useState("");
  const [view, setView] = useState<"board" | "backlog" | "reports">("board");

  const assignees: Record<string, string> = Object.fromEntries(
    (members ?? []).map((m) => [m.user_id, m.username]),
  );

  const filtered = (tasks ?? []).filter(
    (t) =>
      (!query || t.title.toLowerCase().includes(query.toLowerCase())) &&
      (!typeF || t.type === typeF) &&
      (!prioF || t.priority === prioF) &&
      (!assigneeF ||
        (assigneeF === "none" ? !t.assignee_id : t.assignee_id === assigneeF)),
  );

  const move = (taskId: string, status: TaskStatus) =>
    updateTask.mutate({ id: taskId, patch: { status } });

  // Private projects: a 403/404 from the API means no access to this board.
  if (projectError) {
    return (
      <ErrorState
        code="403"
        title="No access to this project"
        message="You’re not a member of this project. Ask an owner to add you, or pick another project."
      />
    );
  }

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

      {/* View tabs */}
      <div className="flex gap-1 border-b">
        {(["board", "backlog", "reports"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium capitalize transition ${
              view === v
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {v}
          </button>
        ))}
      </div>

      {view === "backlog" && <Backlog projectId={id} canEdit={!!perms?.can_edit} />}

      {view === "reports" && <Reports projectId={id} />}

      {view === "board" && (
        <>
      <Protected allowed={perms?.can_edit}>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            createTask.mutate({ title, assignee_id: assigneeId || null });
            setTitle("");
            setAssigneeId("");
          }}
        >
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a task…"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          />
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            title="Assignee"
          >
            <option value="">Unassigned</option>
            {(members ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.username}
              </option>
            ))}
          </select>
          <button className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">
            <Plus className="h-4 w-4" /> Task
          </button>
        </form>
      </Protected>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search issues…"
            className="rounded-lg border bg-white py-1.5 pl-9 pr-3 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <select value={typeF} onChange={(e) => setTypeF(e.target.value)} className="rounded-lg border bg-white px-2.5 py-1.5 text-sm text-slate-600">
          <option value="">All types</option>
          <option value="epic">Epic</option>
          <option value="task">Task</option>
          <option value="story">Story</option>
          <option value="bug">Bug</option>
        </select>
        <select value={prioF} onChange={(e) => setPrioF(e.target.value)} className="rounded-lg border bg-white px-2.5 py-1.5 text-sm text-slate-600">
          <option value="">All priorities</option>
          <option value="urgent">Urgent</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select value={assigneeF} onChange={(e) => setAssigneeF(e.target.value)} className="rounded-lg border bg-white px-2.5 py-1.5 text-sm text-slate-600">
          <option value="">All assignees</option>
          <option value="none">Unassigned</option>
          {(members ?? []).map((m) => (
            <option key={m.user_id} value={m.user_id}>{m.username}</option>
          ))}
        </select>
        {(query || typeF || prioF || assigneeF) && (
          <button
            onClick={() => { setQuery(""); setTypeF(""); setPrioF(""); setAssigneeF(""); }}
            className="text-xs text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        )}
      </div>

      {isLoading ? (
        <LoaderScreen message="Loading tasks" />
      ) : (
        <Board
          tasks={filtered}
          canEdit={!!perms?.can_edit}
          onMove={move}
          assignees={assignees}
          projectKey={project?.key}
        />
      )}
        </>
      )}

    </div>
  );
}
