"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { PRIORITIES, TYPES, TYPE_META } from "@/components/issueMeta";
import {
  useCreateTask,
  useProjectMembers,
  useSprints,
  type TaskPriority,
  type TaskType,
} from "@/lib/api";

export function CreateIssueModal({
  projectId,
  onClose,
}: {
  projectId: string;
  onClose: () => void;
}) {
  const { data: members } = useProjectMembers(projectId);
  const { data: sprints } = useSprints(projectId);
  const create = useCreateTask(projectId);

  const [type, setType] = useState<TaskType>("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignee, setAssignee] = useState("");
  const [sprint, setSprint] = useState("");
  const [points, setPoints] = useState("");
  const [labels, setLabels] = useState("");

  const label = "mb-1 block text-xs font-semibold text-slate-500";
  const ctl =
    "w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    create.mutate(
      {
        title,
        type,
        priority,
        description: description || null,
        assignee_id: assignee || null,
        sprint_id: sprint || null,
        story_points: points === "" ? null : Number(points),
        labels: labels.split(",").map((l) => l.trim()).filter(Boolean),
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 p-4 sm:p-10"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-base font-semibold text-slate-900">Create issue</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
          {/* Type chooser */}
          <div>
            <span className={label}>Issue type</span>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => {
                const M = TYPE_META[t];
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm capitalize transition ${
                      active
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <M.icon className={`h-4 w-4 ${M.color}`} /> {t}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className={label}>Summary *</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className={ctl}
            />
          </div>

          <div>
            <label className={label}>Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Add more detail…"
              className={ctl}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Priority</label>
              <select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)} className={ctl}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Assignee</label>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={ctl}>
                <option value="">Unassigned</option>
                {members?.map((m) => <option key={m.user_id} value={m.user_id}>{m.username}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Sprint</label>
              <select value={sprint} onChange={(e) => setSprint(e.target.value)} className={ctl}>
                <option value="">Backlog</option>
                {(sprints ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Story points</label>
              <input type="number" min={0} value={points} onChange={(e) => setPoints(e.target.value)} className={ctl} />
            </div>
          </div>

          <div>
            <label className={label}>Labels</label>
            <input
              value={labels}
              onChange={(e) => setLabels(e.target.value)}
              placeholder="comma, separated"
              className={ctl}
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              disabled={!title.trim() || create.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {create.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
