"use client";

import { CalendarDays, ChevronRight, Paperclip, Send } from "lucide-react";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { AttachmentItem } from "@/components/AttachmentItem";
import { Avatar } from "@/components/Avatar";
import { LoaderScreen } from "@/components/Loader";
import { LINK_LABELS, PRIORITIES, STATUSES, TYPES, TYPE_META } from "@/components/issueMeta";
import {
  useActivity,
  useAddComment,
  useAddLink,
  useAttachments,
  useChildren,
  useComments,
  useDeleteAttachment,
  useLinks,
  useProject,
  useProjectMembers,
  useRemoveLink,
  useSprints,
  useTasks,
  useUpdateTask,
  useUploadAttachment,
  type LinkType,
  type Task,
} from "@/lib/api";

const STATUS_PILL: Record<string, string> = {
  todo: "bg-slate-100 text-slate-600",
  in_progress: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
};

const ACTIVITY_VERB: Record<string, string> = {
  created: "created this issue",
  commented: "added a comment",
  status: "changed status",
  priority: "changed priority",
  type: "changed type",
  assignee: "updated the assignee",
  linked: "linked an issue",
};

function Chip({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 ${className}`}
    >
      {children}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-slate-500">{label}</div>
      {children}
    </div>
  );
}

export function IssueView({
  projectId,
  taskId,
  canEdit,
}: {
  projectId: string;
  taskId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { data: tasks, isLoading } = useTasks(projectId);
  const { data: project } = useProject(projectId);
  const { data: members } = useProjectMembers(projectId);
  const { data: sprints } = useSprints(projectId);
  const { data: comments } = useComments(taskId);
  const { data: activity } = useActivity(taskId);
  const { data: children } = useChildren(taskId);
  const { data: links } = useLinks(taskId);
  const { data: attachments } = useAttachments(taskId);
  const update = useUpdateTask(projectId);
  const addComment = useAddComment(taskId);
  const addLink = useAddLink(taskId);
  const removeLink = useRemoveLink(taskId);
  const uploadAttachment = useUploadAttachment(taskId);
  const deleteAttachment = useDeleteAttachment(taskId);
  const fileRef = useRef<HTMLInputElement>(null);

  const task = tasks?.find((t) => t.id === taskId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [labels, setLabels] = useState("");
  const [comment, setComment] = useState("");
  const [linkTarget, setLinkTarget] = useState("");
  const [linkType, setLinkType] = useState<LinkType>("relates_to");
  const [preview, setPreview] = useState<string | null>(null);
  const [tab, setTab] = useState<"comments" | "history">("comments");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setLabels(task.labels.join(", "));
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <LoaderScreen message="Loading issue" />;
  if (!task) return <p className="text-sm text-slate-400">Issue not found.</p>;

  const goIssue = (id: string) => router.push(`/projects/${projectId}/issues/${id}`);
  const patch = (p: Partial<Task>) => update.mutate({ id: task.id, patch: p });
  const ro = !canEdit;
  const issueKey = project?.key && task.seq != null ? `${project.key}-${task.seq}` : "Issue";
  const Type = TYPE_META[task.type];
  const reporter = activity?.find((a) => a.action === "created")?.actor_username;
  const ctl =
    "w-full rounded-md border border-transparent px-2 py-1.5 text-sm text-slate-700 outline-none transition hover:border-slate-200 focus:border-indigo-500 disabled:cursor-default disabled:bg-transparent";

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-slate-500">
        <button onClick={() => router.push(`/projects/${projectId}`)} className="font-medium text-slate-600 hover:text-indigo-700">
          {project?.name}
        </button>
        <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
        <Type.icon className={`h-4 w-4 ${Type.color}`} />
        <span className="font-mono font-medium text-slate-500">{issueKey}</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        {/* MAIN */}
        <div className="space-y-6">
          <textarea
            value={title}
            disabled={ro}
            rows={1}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== task.title && patch({ title })}
            className="w-full resize-none rounded-md border border-transparent px-2 py-1 text-2xl font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-indigo-500 disabled:bg-transparent"
          />

          {!ro && (
            <div className="flex gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Paperclip className="h-3.5 w-3.5" /> Attach
              </button>
              <input ref={fileRef} type="file" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment.mutate(f); e.target.value = ""; }} />
            </div>
          )}

          <div>
            <div className="mb-1.5 text-sm font-semibold text-slate-700">Description</div>
            <textarea
              value={description}
              disabled={ro}
              rows={5}
              placeholder={ro ? "—" : "Add a description…"}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== (task.description ?? "") && patch({ description: description || null })}
              className="w-full rounded-lg border px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500 disabled:bg-slate-50"
            />
          </div>

          {(attachments?.length || !ro) && (
            <div>
              <div className="mb-1.5 text-sm font-semibold text-slate-700">
                Attachments {attachments?.length ? `(${attachments.length})` : ""}
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {attachments?.map((a) => (
                  <AttachmentItem key={a.id} taskId={taskId} att={a} canDelete={!ro}
                    onDelete={() => deleteAttachment.mutate(a.id)} onPreview={setPreview} />
                ))}
                {attachments?.length === 0 && <li className="text-sm text-slate-400">No attachments yet.</li>}
              </ul>
            </div>
          )}

          {children && children.length > 0 && (
            <div>
              <div className="mb-1.5 text-sm font-semibold text-slate-700">Child issues ({children.length})</div>
              <ul className="divide-y rounded-lg border">
                {children.map((c) => (
                  <li key={c.id}>
                    <button onClick={() => goIssue(c.id)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50">
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

          <div>
            <div className="mb-1.5 text-sm font-semibold text-slate-700">
              Linked issues {links?.length ? `(${links.length})` : ""}
            </div>
            <ul className="space-y-1">
              {links?.map((l) => (
                <li key={l.id} className="flex items-center gap-2 text-sm">
                  <span className="w-24 shrink-0 text-xs text-slate-400">{LINK_LABELS[l.link_type]}</span>
                  <button onClick={() => goIssue(l.target_id)} className="flex-1 truncate text-left text-slate-700 hover:text-indigo-700">
                    <span className="font-mono text-xs text-slate-400">
                      {project?.key && l.target_seq != null ? `${project.key}-${l.target_seq} ` : ""}
                    </span>
                    {l.target_title}
                  </button>
                  {!ro && (
                    <button onClick={() => removeLink.mutate(l.id)} className="text-slate-300 hover:text-red-500">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {(!links || links.length === 0) && <li className="text-sm text-slate-400">No linked issues.</li>}
            </ul>
            {!ro && (
              <div className="mt-2 flex gap-2">
                <select value={linkType} onChange={(e) => setLinkType(e.target.value as LinkType)} className="rounded-md border px-2 py-1.5 text-xs text-slate-600">
                  {(["blocks", "blocked_by", "relates_to", "duplicates"] as LinkType[]).map((lt) => (
                    <option key={lt} value={lt}>{LINK_LABELS[lt]}</option>
                  ))}
                </select>
                <select value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} className="flex-1 rounded-md border px-2 py-1.5 text-xs text-slate-600">
                  <option value="">Select an issue…</option>
                  {(tasks ?? []).filter((t) => t.id !== task.id).map((t) => (
                    <option key={t.id} value={t.id}>
                      {project?.key && t.seq != null ? `${project.key}-${t.seq} ` : ""}{t.title}
                    </option>
                  ))}
                </select>
                <button disabled={!linkTarget || addLink.isPending}
                  onClick={() => addLink.mutate({ target_id: linkTarget, link_type: linkType }, { onSuccess: () => setLinkTarget("") })}
                  className="rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-900 disabled:opacity-50">
                  Link
                </button>
              </div>
            )}
          </div>

          {/* Activity */}
          <div>
            <div className="mb-3 flex items-center gap-1 border-b">
              {(["comments", "history"] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)}
                  className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium capitalize ${
                    tab === t ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            {tab === "comments" ? (
              <>
                <form className="mb-3 flex gap-2"
                  onSubmit={(e) => { e.preventDefault(); if (!comment.trim()) return; addComment.mutate(comment, { onSuccess: () => setComment("") }); }}>
                  <input value={comment} onChange={(e) => setComment(e.target.value)}
                    placeholder="Add a comment… (use @username to mention)"
                    className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                  <button disabled={addComment.isPending || !comment.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                <ul className="space-y-3">
                  {comments?.map((c) => (
                    <li key={c.id} className="flex gap-2">
                      <Avatar name={c.author_username} size={28} />
                      <div className="flex-1 rounded-lg bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-500">
                          <span className="font-medium text-slate-700">{c.author_username}</span> · {new Date(c.created_at).toLocaleString()}
                        </div>
                        <div className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{c.body}</div>
                      </div>
                    </li>
                  ))}
                  {comments?.length === 0 && <li className="text-sm text-slate-400">No comments yet.</li>}
                </ul>
              </>
            ) : (
              <ul className="space-y-4">
                {activity?.map((a) => {
                  const fromTo =
                    a.detail && a.detail.includes("→")
                      ? a.detail.split("→").map((s) => s.trim())
                      : null;
                  return (
                    <li key={a.id} className="flex gap-2.5">
                      <Avatar name={a.actor_username} size={26} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm leading-relaxed text-slate-600">
                          <span className="font-medium text-slate-800">{a.actor_username}</span>{" "}
                          {ACTIVITY_VERB[a.action] ?? a.action}
                          {fromTo ? (
                            <span className="ml-1 inline-flex items-center gap-1.5">
                              <Chip>{fromTo[0]}</Chip>
                              <span className="text-slate-300">→</span>
                              <Chip>{fromTo[1]}</Chip>
                            </span>
                          ) : a.detail ? (
                            <Chip className="ml-1">{a.detail}</Chip>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-xs text-slate-400">
                          {new Date(a.created_at).toLocaleString(undefined, {
                            month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {(!activity || activity.length === 0) && (
                  <li className="text-sm text-slate-400">No activity yet.</li>
                )}
              </ul>
            )}
          </div>
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-4">
          <select value={task.status} disabled={ro}
            onChange={(e) => patch({ status: e.target.value as Task["status"] })}
            className={`w-full rounded-md px-3 py-1.5 text-sm font-semibold ${STATUS_PILL[task.status]} disabled:opacity-100`}>
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <div className="space-y-3 rounded-lg border bg-white p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Details</div>
            <Field label="Assignee">
              <select value={task.assignee_id ?? ""} disabled={ro} className={ctl}
                onChange={(e) => patch({ assignee_id: e.target.value || null })}>
                <option value="">Unassigned</option>
                {members?.map((m) => <option key={m.user_id} value={m.user_id}>{m.username}</option>)}
              </select>
            </Field>
            <Field label="Reporter">
              <div className="flex items-center gap-2 px-2 py-1 text-sm text-slate-600">
                {reporter ? <Avatar name={reporter} size={20} /> : null}
                {reporter ?? "—"}
              </div>
            </Field>
            <Field label="Type">
              <select value={task.type} disabled={ro} className={ctl}
                onChange={(e) => patch({ type: e.target.value as Task["type"] })}>
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Priority">
              <select value={task.priority} disabled={ro} className={ctl}
                onChange={(e) => patch({ priority: e.target.value as Task["priority"] })}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>
            <Field label="Sprint">
              <select value={task.sprint_id ?? ""} disabled={ro} className={ctl}
                onChange={(e) => patch({ sprint_id: e.target.value || null })}>
                <option value="">Backlog</option>
                {(sprints ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Story points">
              <input type="number" min={0} defaultValue={task.story_points ?? ""} disabled={ro} className={ctl}
                onBlur={(e) => patch({ story_points: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
            <Field label="Parent">
              <select value={task.parent_id ?? ""} disabled={ro} className={ctl}
                onChange={(e) => patch({ parent_id: e.target.value || null })}>
                <option value="">None</option>
                {(tasks ?? []).filter((t) => t.id !== task.id).map((t) => (
                  <option key={t.id} value={t.id}>
                    {project?.key && t.seq != null ? `${project.key}-${t.seq} ` : ""}{t.title}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input type="date" defaultValue={task.due_date ?? ""} disabled={ro} className={ctl}
                onChange={(e) => patch({ due_date: e.target.value || null })} />
            </Field>
            <Field label="Labels">
              <input value={labels} disabled={ro} placeholder="comma, separated" className={ctl}
                onChange={(e) => setLabels(e.target.value)}
                onBlur={() => patch({ labels: labels.split(",").map((l) => l.trim()).filter(Boolean) })} />
            </Field>
          </div>

          <div className="space-y-1 px-1 text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> Created {new Date(task.created_at).toLocaleDateString()}
            </div>
            <div>Updated {new Date(task.updated_at).toLocaleString()}</div>
          </div>
        </aside>
      </div>

      {preview && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-8" onClick={() => setPreview(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="attachment" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
