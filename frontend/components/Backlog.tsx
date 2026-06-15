"use client";

import { ChevronRight, Play, Plus, Square, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { TYPE_META } from "@/components/issueMeta";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  useCreateSprint,
  useDeleteSprint,
  useProject,
  useSprints,
  useTasks,
  useUpdateSprint,
  type Task,
} from "@/lib/api";

function IssueRow({ task, projectKey }: { task: Task; projectKey?: string | null }) {
  const router = useRouter();
  const Type = TYPE_META[task.type];
  return (
    <button
      onClick={() => router.push(`/projects/${task.project_id}/issues/${task.id}`)}
      className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm first:border-t-0 hover:bg-slate-50"
    >
      <Type.icon className={`h-4 w-4 shrink-0 ${Type.color}`} />
      <span className="font-mono text-xs text-slate-400">
        {projectKey && task.seq != null ? `${projectKey}-${task.seq}` : ""}
      </span>
      <span className="flex-1 truncate text-slate-700">{task.title}</span>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
        {task.status}
      </span>
      {task.story_points != null && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-50 px-1 text-xs font-medium text-indigo-600">
          {task.story_points}
        </span>
      )}
    </button>
  );
}

export function Backlog({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const { data: project } = useProject(projectId);
  const { data: sprints } = useSprints(projectId);
  const { data: tasks } = useTasks(projectId);
  const createSprint = useCreateSprint(projectId);
  const updateSprint = useUpdateSprint(projectId);
  const deleteSprint = useDeleteSprint(projectId);
  const [name, setName] = useState("");

  const inSprint = (sid: string) => (tasks ?? []).filter((t) => t.sprint_id === sid);
  const backlog = (tasks ?? []).filter((t) => !t.sprint_id);
  const points = (list: Task[]) =>
    list.reduce((n, t) => n + (t.story_points ?? 0), 0);

  return (
    <div className="space-y-4">
      {canEdit && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            createSprint.mutate({ name }, { onSuccess: () => setName("") });
          }}
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New sprint name…"
            className="flex-1"
          />
          <Button>
            <Plus className="h-4 w-4" /> Sprint
          </Button>
        </form>
      )}

      {sprints?.map((s) => {
        const issues = inSprint(s.id);
        return (
          <section key={s.id} className="rounded-2xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
              <span className="font-semibold text-slate-800">{s.name}</span>
              <Badge tone={s.state === "active" ? "emerald" : "slate"}>{s.state}</Badge>
              {s.goal && <span className="text-sm text-slate-400">· {s.goal}</span>}
              <span className="text-xs text-slate-400">
                {issues.length} issues · {points(issues)} pts
              </span>
              {canEdit && (
                <div className="ml-auto flex items-center gap-1">
                  {s.state === "planned" && (
                    <button
                      onClick={() => updateSprint.mutate({ id: s.id, patch: { state: "active" } })}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      <Play className="h-3 w-3" /> Start
                    </button>
                  )}
                  {s.state === "active" && (
                    <button
                      onClick={() => updateSprint.mutate({ id: s.id, patch: { state: "completed" } })}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                    >
                      <Square className="h-3 w-3" /> Complete
                    </button>
                  )}
                  <button
                    onClick={() => deleteSprint.mutate(s.id)}
                    title="Delete sprint"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
            {issues.length ? (
              issues.map((t) => <IssueRow key={t.id} task={t} projectKey={project?.key} />)
            ) : (
              <div className="px-4 py-3 text-sm text-slate-400">
                No issues. Assign them from an issue’s Sprint field.
              </div>
            )}
          </section>
        );
      })}

      {/* Backlog */}
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="font-semibold text-slate-800">Backlog</span>
          <span className="text-xs text-slate-400">
            {backlog.length} issues · {points(backlog)} pts
          </span>
        </div>
        {backlog.length ? (
          backlog.map((t) => <IssueRow key={t.id} task={t} projectKey={project?.key} />)
        ) : (
          <div className="px-4 py-3 text-sm text-slate-400">Backlog is empty.</div>
        )}
      </section>
    </div>
  );
}
