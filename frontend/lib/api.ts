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
  created_at: string;
  my_role: string | null;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  assignee_id: string | null;
  position: number;
}

export interface Me {
  id: string;
  sub: string;
  email: string;
  username: string;
  given_name: string;
  family_name: string;
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
    mutationFn: (name: string) =>
      authedFetch<Org>("/orgs", { method: "POST", body: JSON.stringify({ name }) }),
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
    mutationFn: (body: { title: string; status?: TaskStatus }) =>
      authedFetch<Task>("/tasks", {
        method: "POST",
        body: JSON.stringify({ project_id: projectId, ...body }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
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
    onSettled: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
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
