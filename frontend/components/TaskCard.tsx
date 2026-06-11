"use client";

import { GripVertical } from "lucide-react";

import type { Task } from "@/lib/api";
import { useDragStore } from "@/lib/store";

export function TaskCard({ task, draggable }: { task: Task; draggable: boolean }) {
  const setDragging = useDragStore((s) => s.setDragging);
  const dragging = useDragStore((s) => s.draggingId === task.id);

  return (
    <div
      draggable={draggable}
      onDragStart={() => setDragging(task.id)}
      onDragEnd={() => setDragging(null)}
      className={`group flex items-start gap-2 rounded-xl border bg-white p-3 text-sm shadow-sm transition ${
        draggable ? "cursor-grab active:cursor-grabbing hover:shadow" : ""
      } ${dragging ? "opacity-50" : ""}`}
    >
      {draggable && (
        <GripVertical className="mt-0.5 h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-400" />
      )}
      <div>
        <div className="font-medium text-slate-800">{task.title}</div>
        {task.description && (
          <div className="mt-1 text-xs text-slate-500">{task.description}</div>
        )}
      </div>
    </div>
  );
}
