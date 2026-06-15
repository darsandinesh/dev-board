"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { useCreateTask, type TaskStatus } from "@/lib/api";

/**
 * A compact "+ Add issue" affordance at the bottom of a board column.
 * Click → inline title input; Enter creates (in this column's status), Esc cancels.
 */
export function InlineAddCard({ projectId, status }: { projectId: string; status: TaskStatus }) {
  const createTask = useCreateTask(projectId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const submit = () => {
    const t = title.trim();
    if (!t) {
      setOpen(false);
      return;
    }
    createTask.mutate(
      { title: t, status },
      {
        onSuccess: () => {
          setTitle("");
          toast.success("Issue created");
        },
      },
    );
    setTitle("");
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-slate-400 transition hover:bg-white hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <Plus className="h-4 w-4" /> Add issue
      </button>
    );
  }

  return (
    <textarea
      autoFocus
      rows={2}
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={submit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          submit();
        } else if (e.key === "Escape") {
          setTitle("");
          setOpen(false);
        }
      }}
      placeholder="What needs to be done?"
      className="mt-1 w-full resize-none rounded-lg border border-indigo-300 bg-white px-2.5 py-2 text-sm text-slate-800 shadow-sm outline-none ring-2 ring-indigo-100 dark:border-indigo-500 dark:bg-slate-800 dark:text-slate-100 dark:ring-indigo-900/50"
    />
  );
}
