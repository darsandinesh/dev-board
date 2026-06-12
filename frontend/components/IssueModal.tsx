"use client";

import { Send, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/Avatar";
import { LINK_LABELS, PRIORITIES, STATUSES, TYPES } from "@/components/issueMeta";
import {
  useActivity,
  useAddComment,
  useAddLink,
  useChildren,
  useComments,
  useLinks,
  useProject,
  useProjectMembers,
  useRemoveLink,
  useSprints,
  useTasks,
  useUpdateTask,
  type LinkType,
  type Task,
} from "@/lib/api";
import { useDragStore } from "@/lib/store";

export function IssueModal({ projectId, canEdit }: { projectId: string; canEdit: boolean }) {
  const selectedTaskId = useDragStore((s) => s.selectedTaskId);
  const closeTask = useDragStore((s) => s.closeTask);
  if (!selectedTaskId) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30" onClick={closeTask}>
      <div
        className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <IssueDetail
          taskId={selectedTaskId}
          projectId={projectId}
          canEdit={canEdit}
          onClose={closeTask}
        />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-2 py-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function IssueDetail({
  taskId,
  projectId,
  canEdit,
  onClose,
}: {
  taskId: string;
  projectId: string;
  canEdit: boolean;
  onClose: () => void;
}) {
  const { data: tasks } = useTasks(projectId);
  const { data: project } = useProject(projectId);
  const { data: members } = useProjectMembers(projectId);
  const { data: sprints } = useSprints(projectId);
  const { data: comments } = useComments(taskId);
  const { data: activity } = useActivity(taskId);
  const { data: children } = useChildren(taskId);
  const { data: links } = useLinks(taskId);
  const update = useUpdateTask(projectId);
  const addComment = useAddComment(taskId);
  const addLink = useAddLink(taskId);
  const removeLink = useRemoveLink(taskId);
  const openTask = useDragStore((s) => s.openTask);

  const task = tasks?.find((t) => t.id === taskId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState("");
  const [comment, setComment] = useState("");
  const [linkTarget, setLinkTarget] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("relates_to");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setLabels(task.labels.join(", "));
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) {
    return (
      <div className="p-6 text-slate-500">
        Task not found. <button onClick={onClose} className="text-indigo-600">Close</button>
      </div>
    );
  }

  const patch = (p: Partial<Task>) => update.mutate({ id: task.id, patch: p });
  const ro = !canEdit;
  const sel =
    "rounded-lg border px-2.5 py-1.5 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-mono text-sm font-semibold text-slate-500">
          {project?.key && task.seq != null ? `${project.key}-${task.seq}` : "Issue"}
        </span>
        <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {/* Title */}
        <input
          value={title}
          disabled={ro}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== task.title && patch({ title })}
          className="w-full rounded-lg border border-transparent px-2 py-1 text-lg font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-indigo-500 disabled:bg-transparent"
        />

        {/* Fields */}
        <div className="rounded-xl border bg-slate-50/60 px-4 py-2">
          <Row label="Type">
            <select value={task.type} disabled={ro} className={sel}
              onChange={(e) => patch({ type: e.target.value as Task["type"] })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Row>
          <Row label="Status">
            <select value={task.status} disabled={ro} className={sel}
              onChange={(e) => patch({ status: e.target.value as Task["status"] })}>
              {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Row>
          <Row label="Priority">
            <select value={task.priority} disabled={ro} className={sel}
              onChange={(e) => patch({ priority: e.target.value as Task["priority"] })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Row>
          <Row label="Assignee">
            <select value={task.assignee_id ?? ""} disabled={ro} className={sel}
              onChange={(e) => patch({ assignee_id: e.target.value || null })}>
              <option value="">Unassigned</option>
              {members?.map((m) => (
                <option key={m.user_id} value={m.user_id}>{m.username}</option>
              ))}
            </select>
          </Row>
          <Row label="Points">
            <input type="number" min={0} defaultValue={task.story_points ?? ""} disabled={ro}
              className={`${sel} w-24`}
              onBlur={(e) => patch({ story_points: e.target.value === "" ? null : Number(e.target.value) })} />
          </Row>
          <Row label="Due date">
            <input type="date" defaultValue={task.due_date ?? ""} disabled={ro} className={sel}
              onChange={(e) => patch({ due_date: e.target.value || null })} />
          </Row>
          <Row label="Labels">
            <input value={labels} disabled={ro} placeholder="comma, separated"
              className={`${sel} w-full`}
              onChange={(e) => setLabels(e.target.value)}
              onBlur={() => patch({ labels: labels.split(",").map((l) => l.trim()).filter(Boolean) })} />
          </Row>
          <Row label="Parent">
            <select value={task.parent_id ?? ""} disabled={ro} className={`${sel} w-full`}
              onChange={(e) => patch({ parent_id: e.target.value || null })}>
              <option value="">None</option>
              {(tasks ?? [])
                .filter((t) => t.id !== task.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {project?.key && t.seq != null ? `${project.key}-${t.seq} ` : ""}{t.title}
                  </option>
                ))}
            </select>
          </Row>
          <Row label="Sprint">
            <select value={task.sprint_id ?? ""} disabled={ro} className={`${sel} w-full`}
              onChange={(e) => patch({ sprint_id: e.target.value || null })}>
              <option value="">Backlog</option>
              {(sprints ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.state})</option>
              ))}
            </select>
          </Row>
        </div>

        {/* Description */}
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Description</div>
          <textarea
            value={description}
            disabled={ro}
            rows={4}
            placeholder={ro ? "—" : "Add a description…"}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => description !== (task.description ?? "") && patch({ description: description || null })}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500 disabled:bg-slate-50"
          />
        </div>

        {/* Sub-tasks / epic children */}
        {children && children.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Child issues ({children.length})
            </div>
            <ul className="divide-y rounded-lg border">
              {children.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => openTask(c.id)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="font-mono text-xs text-slate-400">
                      {project?.key && c.seq != null ? `${project.key}-${c.seq}` : ""}
                    </span>
                    <span className="flex-1 truncate text-slate-700">{c.title}</span>
                    <span className="text-xs text-slate-400">{c.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Linked issues */}
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Linked issues {links?.length ? `(${links.length})` : ""}
          </div>
          <ul className="space-y-1">
            {links?.map((l) => (
              <li key={l.id} className="flex items-center gap-2 text-sm">
                <span className="w-24 shrink-0 text-xs text-slate-400">
                  {LINK_LABELS[l.link_type]}
                </span>
                <button
                  onClick={() => openTask(l.target_id)}
                  className="flex-1 truncate text-left text-slate-700 hover:text-indigo-700"
                >
                  <span className="font-mono text-xs text-slate-400">
                    {project?.key && l.target_seq != null ? `${project.key}-${l.target_seq} ` : ""}
                  </span>
                  {l.target_title}
                </button>
                {!ro && (
                  <button
                    onClick={() => removeLink.mutate(l.id)}
                    className="text-slate-300 hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {!ro && (
            <div className="mt-2 flex gap-2">
              <select value={linkType} onChange={(e) => setLinkType(e.target.value as LinkType)}
                className="rounded-lg border px-2 py-1.5 text-xs text-slate-600">
                {(["blocks", "blocked_by", "relates_to", "duplicates"] as LinkType[]).map((lt) => (
                  <option key={lt} value={lt}>{LINK_LABELS[lt]}</option>
                ))}
              </select>
              <select value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)}
                className="flex-1 rounded-lg border px-2 py-1.5 text-xs text-slate-600">
                <option value="">Select an issue…</option>
                {(tasks ?? []).filter((t) => t.id !== task.id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {project?.key && t.seq != null ? `${project.key}-${t.seq} ` : ""}{t.title}
                  </option>
                ))}
              </select>
              <button
                disabled={!linkTarget || addLink.isPending}
                onClick={() => {
                  addLink.mutate(
                    { target_id: linkTarget, link_type: linkType },
                    { onSuccess: () => setLinkTarget("") },
                  );
                }}
                className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50"
              >
                Link
              </button>
            </div>
          )}
        </div>

        {/* Comments */}
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            Comments {comments?.length ? `(${comments.length})` : ""}
          </div>
          <ul className="space-y-3">
            {comments?.map((c) => (
              <li key={c.id} className="flex gap-2">
                <Avatar name={c.author_username} size={28} />
                <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{c.author_username}</span>{" "}
                    · {new Date(c.created_at).toLocaleString()}
                  </div>
                  <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{c.body}</div>
                </div>
              </li>
            ))}
            {comments?.length === 0 && (
              <li className="text-sm text-slate-400">No comments yet.</li>
            )}
          </ul>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!comment.trim()) return;
              addComment.mutate(comment, { onSuccess: () => setComment("") });
            }}
          >
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <button
              disabled={addComment.isPending || !comment.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Activity */}
        {activity && activity.length > 0 && (
          <div>
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              Activity
            </div>
            <ul className="space-y-1.5 border-l-2 border-slate-100 pl-3">
              {activity.map((a) => (
                <li key={a.id} className="text-xs text-slate-500">
                  <span className="font-medium text-slate-700">{a.actor_username}</span>{" "}
                  {a.action === "created" && "created this issue"}
                  {a.action === "commented" && "commented"}
                  {a.action === "status" && `changed status ${a.detail ?? ""}`}
                  {a.action === "priority" && `changed priority ${a.detail ?? ""}`}
                  {a.action === "type" && `changed type ${a.detail ?? ""}`}
                  {a.action === "assignee" && `${a.detail ?? "changed assignee"}`}
                  <span className="ml-1 text-slate-300">
                    · {new Date(a.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
