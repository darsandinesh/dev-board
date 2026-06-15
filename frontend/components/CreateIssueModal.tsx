"use client";

import { useState } from "react";
import { toast } from "sonner";

import { PRIORITIES, TYPES, TYPE_META } from "@/components/issueMeta";
import { Select } from "@/components/Select";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input, Label, Textarea } from "@/components/ui/Input";
import {
  useCreateTask,
  useProjectMembers,
  useSprints,
  type TaskPriority,
  type TaskType,
} from "@/lib/api";
import { cn } from "@/lib/cn";

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
        labels: labels
          .split(",")
          .map((l) => l.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          toast.success("Issue created");
          onClose();
        },
      },
    );
  };

  return (
    <Dialog title="Create issue" onClose={onClose}>
      <form onSubmit={submit} className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
        <div>
          <Label>Issue type</Label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => {
              const M = TYPE_META[t];
              const active = type === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm capitalize transition",
                    active
                      ? "border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  <M.icon className={cn("h-4 w-4", M.color)} /> {t}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label>Summary *</Label>
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
          />
        </div>

        <div>
          <Label>Description</Label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Add more detail…"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Priority</Label>
            <Select
              value={priority}
              onChange={(v) => setPriority(v as TaskPriority)}
              className="w-full capitalize"
              options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            />
          </div>
          <div>
            <Label>Assignee</Label>
            <Select
              value={assignee}
              onChange={setAssignee}
              className="w-full"
              options={[
                { value: "", label: "Unassigned" },
                ...(members ?? []).map((m) => ({ value: m.user_id, label: m.username })),
              ]}
            />
          </div>
          <div>
            <Label>Sprint</Label>
            <Select
              value={sprint}
              onChange={setSprint}
              className="w-full"
              options={[
                { value: "", label: "Backlog" },
                ...(sprints ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
          <div>
            <Label>Story points</Label>
            <Input
              type="number"
              min={0}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label>Labels</Label>
          <Input
            value={labels}
            onChange={(e) => setLabels(e.target.value)}
            placeholder="comma, separated"
          />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!title.trim() || create.isPending}>
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
