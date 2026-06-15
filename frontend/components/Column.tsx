"use client";

import { useState } from "react";

import type { Task, TaskStatus } from "@/lib/api";
import { useDragStore } from "@/lib/store";
import { InlineAddCard } from "./InlineAddCard";
import { TaskCard } from "./TaskCard";

const ACCENT: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-amber-400",
  done: "bg-emerald-500",
};

export function Column({
  status,
  title,
  tasks,
  canEdit,
  onDropTask,
  assignees = {},
  projectKey,
  projectId,
}: {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  canEdit: boolean;
  onDropTask: (taskId: string, status: TaskStatus) => void;
  assignees?: Record<string, string>;
  projectKey?: string | null;
  projectId: string;
}) {
  const draggingId = useDragStore((s) => s.draggingId);
  const [over, setOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        if (canEdit) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={() => setOver(false)}
      onDrop={() => {
        setOver(false);
        if (canEdit && draggingId) onDropTask(draggingId, status);
      }}
      className={`flex w-full flex-col rounded-2xl border bg-slate-100/70 p-3 transition ${
        over ? "ring-2 ring-indigo-400" : ""
      }`}
    >
      <h2 className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-slate-600">
        <span className={`h-2 w-2 rounded-full ${ACCENT[status]}`} />
        {title}
        <span className="ml-auto rounded-full bg-white px-2 text-xs text-slate-400">
          {tasks.length}
        </span>
      </h2>
      <div className="flex min-h-[60px] flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            draggable={canEdit}
            assignee={t.assignee_id ? assignees[t.assignee_id] : undefined}
            projectKey={projectKey}
          />
        ))}
      </div>
      {canEdit && <InlineAddCard projectId={projectId} status={status} />}
    </div>
  );
}
