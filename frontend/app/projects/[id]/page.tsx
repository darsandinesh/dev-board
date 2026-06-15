"use client";

import { ArrowLeft, Eye, Plus, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Backlog } from "@/components/Backlog";
import { Board } from "@/components/Board";
import { CreateIssueModal } from "@/components/CreateIssueModal";
import { Reports } from "@/components/Reports";
import { Select } from "@/components/Select";
import { Button, buttonClass } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Tabs } from "@/components/ui/Tabs";
import { BoardSkeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ErrorState";
import { Protected } from "@/components/Protected";
import {
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
  const { data: members } = useProjectMembers(id);
  const [showCreate, setShowCreate] = useState(false);
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
      (!assigneeF || (assigneeF === "none" ? !t.assignee_id : t.assignee_id === assigneeF)),
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
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {project?.name ?? "Project"}
            </h1>
            {project?.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{project.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {!perms?.can_edit && (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <Eye className="h-3.5 w-3.5" /> Read-only
              </span>
            )}
            <Protected allowed={perms?.can_edit}>
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4" /> Create
              </Button>
            </Protected>
            <Protected allowed={perms?.is_owner}>
              <Link
                href={`/projects/${id}/settings`}
                className={buttonClass({ variant: "secondary", size: "sm" })}
              >
                <Settings className="h-4 w-4" /> Settings
              </Link>
            </Protected>
          </div>
        </div>
      </div>

      {/* View tabs */}
      <Tabs
        value={view}
        onChange={(v) => setView(v as typeof view)}
        tabs={[
          { value: "board", label: "Board" },
          { value: "backlog", label: "Backlog" },
          { value: "reports", label: "Reports" },
        ]}
      />

      {view === "backlog" && <Backlog projectId={id} canEdit={!!perms?.can_edit} />}

      {view === "reports" && <Reports projectId={id} />}

      {view === "board" && (
        <>
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search issues…"
                className="w-auto py-1.5 pl-9"
              />
            </div>
            <Select
              value={typeF}
              onChange={setTypeF}
              options={[
                { value: "", label: "All types" },
                { value: "epic", label: "Epic" },
                { value: "task", label: "Task" },
                { value: "story", label: "Story" },
                { value: "bug", label: "Bug" },
              ]}
            />
            <Select
              value={prioF}
              onChange={setPrioF}
              options={[
                { value: "", label: "All priorities" },
                { value: "urgent", label: "Urgent" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
            />
            <Select
              value={assigneeF}
              onChange={setAssigneeF}
              options={[
                { value: "", label: "All assignees" },
                { value: "none", label: "Unassigned" },
                ...(members ?? []).map((m) => ({ value: m.user_id, label: m.username })),
              ]}
            />
            {(query || typeF || prioF || assigneeF) && (
              <button
                onClick={() => {
                  setQuery("");
                  setTypeF("");
                  setPrioF("");
                  setAssigneeF("");
                }}
                className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Clear
              </button>
            )}
          </div>

          {isLoading ? (
            <BoardSkeleton />
          ) : (
            <Board
              tasks={filtered}
              canEdit={!!perms?.can_edit}
              onMove={move}
              assignees={assignees}
              projectKey={project?.key}
              projectId={id}
            />
          )}
        </>
      )}

      {showCreate && <CreateIssueModal projectId={id} onClose={() => setShowCreate(false)} />}
    </div>
  );
}
