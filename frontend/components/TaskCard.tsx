"use client";

import { useRouter } from "next/navigation";

import { Avatar } from "@/components/Avatar";
import { PRIORITY_META, TYPE_META } from "@/components/issueMeta";
import type { Task } from "@/lib/api";
import { useDragStore } from "@/lib/store";

export function TaskCard({
  task,
  draggable,
  assignee,
  projectKey,
}: {
  task: Task;
  draggable: boolean;
  assignee?: string;
  projectKey?: string | null;
}) {
  const setDragging = useDragStore((s) => s.setDragging);
  const dragging = useDragStore((s) => s.draggingId === task.id);
  const router = useRouter();

  const Type = TYPE_META[task.type];
  const Prio = PRIORITY_META[task.priority];

  return (
    <div
      draggable={draggable}
      onDragStart={() => setDragging(task.id)}
      onDragEnd={() => setDragging(null)}
      onClick={() => router.push(`/projects/${task.project_id}/issues/${task.id}`)}
      className={`group cursor-pointer rounded-xl border bg-white p-3 text-sm shadow-sm transition hover:border-indigo-300 hover:shadow dark:border-slate-800 dark:bg-slate-800 dark:hover:border-indigo-500 ${
        dragging ? "opacity-50" : ""
      }`}
    >
      <div className="font-medium text-slate-800 dark:text-slate-100">{task.title}</div>

      {task.labels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.labels.map((l) => (
            <span
              key={l}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300"
            >
              {l}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <Type.icon className={`h-4 w-4 ${Type.color}`} />
        <Prio.icon className={`h-4 w-4 ${Prio.color}`} />
        {projectKey && task.seq != null && (
          <span className="font-mono font-medium text-slate-400">
            {projectKey}-{task.seq}
          </span>
        )}
        {task.story_points != null && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {task.story_points}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {assignee && (
            <span title={`Assigned to ${assignee}`}>
              <Avatar name={assignee} size={20} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
