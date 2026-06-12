"use client";

import type { Task, TaskStatus } from "@/lib/api";
import { Column } from "./Column";

const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "todo", title: "To Do" },
  { status: "in_progress", title: "In Progress" },
  { status: "done", title: "Done" },
];

export function Board({
  tasks,
  canEdit,
  onMove,
  assignees = {},
  projectKey,
}: {
  tasks: Task[];
  canEdit: boolean;
  onMove: (taskId: string, status: TaskStatus) => void;
  assignees?: Record<string, string>;
  projectKey?: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {COLUMNS.map((c) => (
        <Column
          key={c.status}
          status={c.status}
          title={c.title}
          canEdit={canEdit}
          onDropTask={onMove}
          assignees={assignees}
          projectKey={projectKey}
          tasks={tasks
            .filter((t) => t.status === c.status)
            .sort((a, b) => a.position - b.position)}
        />
      ))}
    </div>
  );
}
