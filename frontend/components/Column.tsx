"use client";

import type { Task, TaskStatus } from "@/lib/api";
import { useDragStore } from "@/lib/store";
import { TaskCard } from "./TaskCard";

export function Column({
  status,
  title,
  tasks,
  canEdit,
  onDropTask,
}: {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  canEdit: boolean;
  onDropTask: (taskId: string, status: TaskStatus) => void;
}) {
  const draggingId = useDragStore((s) => s.draggingId);

  return (
    <div
      onDragOver={(e) => {
        if (canEdit) e.preventDefault();
      }}
      onDrop={() => {
        if (canEdit && draggingId) onDropTask(draggingId, status);
      }}
      className="flex w-full flex-col rounded-lg bg-slate-100 p-3"
    >
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title} <span className="text-slate-400">({tasks.length})</span>
      </h2>
      <div className="flex flex-col gap-2">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} draggable={canEdit} />
        ))}
      </div>
    </div>
  );
}
