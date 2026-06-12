"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { getSession, signIn } from "next-auth/react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ---- types -----------------------------------------------------------------
export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  key: string | null;
  created_at: string;
  my_role: string | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskType = "epic" | "task" | "story" | "bug";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type LinkType = "blocks" | "blocked_by" | "relates_to" | "duplicates";

export type SprintState = "planned" | "active" | "completed";

export interface Sprint {
  id: string;
  project_id: string;
  name: string;
  goal: string | null;
  state: SprintState;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  parent_id: string | null;
  sprint_id: string | null;
  seq: number | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  type: TaskType;
  priority: TaskPriority;
  labels: string[];
  story_points: number | null;
  due_date: string | null;
  assignee_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface TaskSummary {
  id: string;
  seq: number | null;
  title: string;
  status: TaskStatus;
  type: TaskType;
}

export interface Link {
  id: string;
  link_type: LinkType;
  target_id: string;
  target_seq: number | null;
  target_title: string;
  target_status: TaskStatus;
}

export interface Comment {
  id: string;
  task_id: string;
  author_id: string;
  author_username: string;
  body: string;
  created_at: string;
}

export interface Activity {
  id: string;
  actor_username: string;
  action: string;
  detail: string | null;
  created_at: string;
}

export interface Me {
  id: string;
  sub: string;
  email: string;
  username: string;
  given_name: string;
  family_name: string;
  roles: string[];
  is_platform_admin: boolean;
}

export interface Org {
  id: string;
  name: string;
  created_at: string;
  my_role: string;
}

export interface Member {
  user_id: string;
  username: string;
  role: string;
}

export interface Permissions {
  can_view: boolean;
  can_edit: boolean;
  is_owner: boolean;
}

// ---- fetch wrapper ----------------------------------------------------------
async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = await getSession();
  if (session?.error === "RefreshAccessTokenError") {
    await signIn("keycloak"); // refresh failed → force re-login
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.accessToken ?? ""}`,
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) {
    await signIn("keycloak");
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    throw await res.json().catch(() => ({ detail: res.statusText }));
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export { authedFetch };

// ---- hooks ------------------------------------------------------------------
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => authedFetch<Me>("/me"),
  });
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => authedFetch<Project[]>("/projects"),
  });
}

export function useOrgs() {
  return useQuery({
    queryKey: ["orgs"],
    queryFn: () => authedFetch<Org[]>("/orgs"),
  });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; admin_user_id?: string | null }) =>
      authedFetch<Org>("/orgs", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orgs"] }),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { org_id: string; name: string; description?: string }) =>
      authedFetch<Project>("/projects", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () => authedFetch<Project>(`/projects/${id}`),
  });
}

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => authedFetch<Task[]>(`/tasks?project_id=${projectId}`),
  });
}

export function useComments(taskId: string) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => authedFetch<Comment[]>(`/tasks/${taskId}/comments`),
  });
}

// ---- attachments ------------------------------------------------------------
export interface Attachment {
  id: string;
  task_id: string;
  filename: string;
  content_type: string;
  size: number;
  created_at: string;
}

export function useAttachments(taskId: string) {
  return useQuery({
    queryKey: ["attachments", taskId],
    queryFn: () => authedFetch<Attachment[]>(`/tasks/${taskId}/attachments`),
  });
}

export function useUploadAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const session = await getSession();
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/tasks/${taskId}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.accessToken ?? ""}` },
        body: form, // browser sets multipart boundary
      });
      if (!res.ok) throw await res.json().catch(() => ({ detail: res.statusText }));
      return (await res.json()) as Attachment;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments", taskId] }),
  });
}

export function useDeleteAttachment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authedFetch<null>(`/tasks/${taskId}/attachments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["attachments", taskId] }),
  });
}

/** Download an attachment with the bearer token, then save via a blob URL. */
export async function downloadAttachment(taskId: string, att: Attachment) {
  const session = await getSession();
  const res = await fetch(`${API}/tasks/${taskId}/attachments/${att.id}/download`, {
    headers: { Authorization: `Bearer ${session?.accessToken ?? ""}` },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---- notifications ----------------------------------------------------------
export interface Notification {
  id: string;
  kind: string;
  message: string;
  task_id: string | null;
  actor_username: string | null;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => authedFetch<Notification[]>("/notifications"),
    refetchInterval: 20_000, // light polling
  });
}

export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authedFetch<null>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authedFetch<null>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
}

// ---- reports ----------------------------------------------------------------
export interface Report {
  total: number;
  done: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_priority: Record<string, number>;
  by_assignee: Record<string, number>;
  points_total: number;
  points_done: number;
  active_sprints: {
    id: string;
    name: string;
    total: number;
    done: number;
    points: number;
    points_done: number;
  }[];
}

export function useReport(projectId: string) {
  return useQuery({
    queryKey: ["report", projectId],
    queryFn: () => authedFetch<Report>(`/projects/${projectId}/report`),
  });
}

// ---- sprints ----------------------------------------------------------------
export function useSprints(projectId: string) {
  return useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => authedFetch<Sprint[]>(`/sprints?project_id=${projectId}`),
  });
}

export function useCreateSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; goal?: string }) =>
      authedFetch<Sprint>("/sprints", {
        method: "POST",
        body: JSON.stringify({ project_id: projectId, ...body }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints", projectId] }),
  });
}

export function useUpdateSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Sprint> }) =>
      authedFetch<Sprint>(`/sprints/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints", projectId] }),
  });
}

export function useDeleteSprint(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      authedFetch<null>(`/sprints/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sprints", projectId] }),
  });
}

export function useChildren(taskId: string) {
  return useQuery({
    queryKey: ["children", taskId],
    queryFn: () => authedFetch<TaskSummary[]>(`/tasks/${taskId}/children`),
  });
}

export function useLinks(taskId: string) {
  return useQuery({
    queryKey: ["links", taskId],
    queryFn: () => authedFetch<Link[]>(`/tasks/${taskId}/links`),
  });
}

export function useAddLink(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { target_id: string; link_type: LinkType }) =>
      authedFetch<Link>(`/tasks/${taskId}/links`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", taskId] }),
  });
}

export function useRemoveLink(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (linkId: string) =>
      authedFetch<null>(`/tasks/${taskId}/links/${linkId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["links", taskId] }),
  });
}

export function useActivity(taskId: string) {
  return useQuery({
    queryKey: ["activity", taskId],
    queryFn: () => authedFetch<Activity[]>(`/tasks/${taskId}/activity`),
  });
}

export function useAddComment(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      authedFetch<Comment>(`/tasks/${taskId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", taskId] });
      qc.invalidateQueries({ queryKey: ["activity", taskId] });
    },
  });
}

export function usePermissions(object: string) {
  return useQuery({
    queryKey: ["perms", object],
    queryFn: () => authedFetch<Permissions>(`/me/permissions?object=${object}`),
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ["members", projectId],
    queryFn: () => authedFetch<Member[]>(`/projects/${projectId}/members`),
  });
}

export function useCreateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { title: string; status?: TaskStatus; assignee_id?: string | null }) =>
      authedFetch<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({ project_id: projectId, ...body }),
      }),
    // Optimistically add the new task so it shows on the board immediately.
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["tasks", projectId] });
      const prev = qc.getQueryData<Task[]>(["tasks", projectId]);
      const optimistic: Task = {
        id: `temp-${Date.now()}`,
        project_id: projectId,
        parent_id: null,
        sprint_id: null,
        seq: null,
        title: body.title,
        description: null,
        status: body.status ?? "todo",
        type: "task",
        priority: "medium",
        labels: [],
        story_points: null,
        due_date: null,
        assignee_id: body.assignee_id ?? null,
        position: 999,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      qc.setQueryData<Task[]>(["tasks", projectId], (old) => [...(old ?? []), optimistic]);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", projectId], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}

export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Task> }) =>
      authedFetch<Task>(`/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      }),
    // optimistic update for snappy Kanban drag
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: ["tasks", projectId] });
      const prev = qc.getQueryData<Task[]>(["tasks", projectId]);
      qc.setQueryData<Task[]>(["tasks", projectId], (old) =>
        (old ?? []).map((t) => (t.id === id ? { ...t, ...patch } : t)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tasks", projectId], ctx.prev);
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: ["tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["activity", vars.id] });
    },
  });
}

export function useUpdateMemberRole(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      authedFetch<Member>(`/projects/${projectId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", projectId] }),
  });
}

export function useAddProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      authedFetch<Member>(`/projects/${projectId}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", projectId] }),
  });
}

export function useRemoveProjectMember(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      authedFetch<null>(`/projects/${projectId}/members/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", projectId] }),
  });
}

// ---- user search ------------------------------------------------------------
export interface UserResult {
  id: string;
  username: string;
  email: string;
}

export function useUserSearch(query: string) {
  return useQuery({
    queryKey: ["users", query],
    queryFn: () =>
      authedFetch<UserResult[]>(`/users?search=${encodeURIComponent(query)}`),
  });
}

// ---- org members ------------------------------------------------------------
export function useOrgMembers(orgId: string | null) {
  return useQuery({
    queryKey: ["org-members", orgId],
    enabled: !!orgId,
    queryFn: () => authedFetch<Member[]>(`/orgs/${orgId}/members`),
  });
}

export function useAddOrgMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      authedFetch<Member>(`/orgs/${orgId}/members`, {
        method: "POST",
        body: JSON.stringify({ user_id: userId, role }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["org-members", orgId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateOrgMemberRole(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      authedFetch<Member>(`/orgs/${orgId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
}

export function useRemoveOrgMember(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      authedFetch<null>(`/orgs/${orgId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["org-members", orgId] }),
  });
}
