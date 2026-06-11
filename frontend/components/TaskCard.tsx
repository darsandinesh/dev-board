"use client";

import type { Task } from "@/lib/api";
import { useDragStore } from "@/lib/store";

export function TaskCard({ task, draggable }: { task: Task; draggable: boolean }) {
  const setDragging = useDragStore((s) => s.setDragging);
  return (
    <div
      draggable={draggable}
      onDragStart={() => setDragging(task.id)}
      onDragEnd={() => setDragging(null)}
      className={`rounded-md border bg-white p-3 text-sm shadow-sm ${
        draggable ? "cursor-grab active:cursor-grabbing" : ""
      }`}
    >
      <div className="font-medium">{task.title}</div>
      {task.description && (
        <div className="mt-1 text-xs text-slate-500">{task.description}</div>
      )}
    </div>
  );
}
