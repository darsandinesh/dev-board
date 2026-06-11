# 06 — Frontend (Next.js)

Day 4. The UI is a *vehicle* for the auth flow — keep it simple. The interesting parts are: login via Keycloak, attaching the JWT, and rendering permission-aware UI.

## Stack

- **Next.js (App Router)** + TypeScript + Tailwind
- **next-auth** with the Keycloak provider (OIDC)
- **TanStack Query** for all server data
- **Zustand** for local UI state (selected project, filters, drag state)

## Structure

```
frontend/
├── app/
│   ├── layout.tsx                 # SessionProvider + QueryClientProvider
│   ├── page.tsx                   # project list (home)
│   ├── projects/[id]/
│   │   ├── page.tsx               # Kanban board
│   │   └── settings/page.tsx      # member roles (owner/admin only)
│   └── api/auth/[...nextauth]/route.ts   # next-auth handler
├── lib/
│   ├── auth.ts                    # next-auth config (Keycloak provider)
│   ├── api.ts                     # fetch wrapper + TanStack hooks
│   └── store.ts                   # Zustand stores
├── components/
│   ├── Board.tsx, Column.tsx, TaskCard.tsx
│   ├── MemberTable.tsx
│   └── Protected.tsx              # gate for hiding/showing by permission
└── .env.local
```

## Auth wiring (next-auth + Keycloak)

`lib/auth.ts`:
```ts
import KeycloakProvider from "next-auth/providers/keycloak";

export const authOptions = {
  providers: [
    KeycloakProvider({
      clientId: process.env.KEYCLOAK_CLIENT_ID!,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET!,
      issuer: process.env.KEYCLOAK_ISSUER!,
    }),
  ],
  callbacks: {
    // persist the access token + expiry into the session JWT
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.expiresAt = account.expires_at;
        token.refreshToken = account.refresh_token;
      }
      // (Day 6) refresh when expired — see Token Refresh below
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      return session;
    },
  },
};
```

> Note: next-auth stores its own session cookie. The thing the **backend** cares about is Keycloak's `access_token`, which we stash on the token/session so `api.ts` can attach it as a Bearer header. Don't send next-auth's session JWT to the backend — send Keycloak's access token.

## API client

`lib/api.ts`:
```ts
import { getSession } from "next-auth/react";

async function authedFetch(path: string, init: RequestInit = {}) {
  const session = await getSession();
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.accessToken}`,
    },
  });
  if (res.status === 401) { /* trigger re-login */ }
  if (!res.ok) throw await res.json();
  return res.status === 204 ? null : res.json();
}

export function useProjects() {
  return useQuery({ queryKey: ["projects"], queryFn: () => authedFetch("/projects") });
}
export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => authedFetch(`/tasks?project_id=${projectId}`),
  });
}
export function useUpdateTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }) => authedFetch(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks", projectId] }),
  });
}
```

## Pages

### `/` — Project list
- `useProjects()` → cards. Each shows name, org, and `my_role`.
- "New project" button only enabled if the user is admin of some org (you'll know from a `/me/orgs` call or the org list).

### `/projects/[id]` — Kanban board
- Three columns: To Do / In Progress / Done, fed by `useTasks(id)` grouped by `status`.
- Drag a card → `useUpdateTask` PATCH with new `status` + `position`. Optimistic update via TanStack Query for snappy UX.
- Zustand holds transient drag state and the active filter.

### `/projects/[id]/settings` — Members
- `MemberTable` lists project members with role dropdowns.
- Only rendered/enabled for project `owner` (or org admin). Gate with `<Protected>`.

## Permission-aware UI

Two layers, both needed:

1. **Hide controls** the user can't use (UX). Use the `/me/permissions?object=...` endpoint or the `my_role` field:
   ```tsx
   const { data: perms } = useQuery({
     queryKey: ["perms", `project:${id}`],
     queryFn: () => authedFetch(`/me/permissions?object=project:${id}`),
   });
   {perms?.can_edit && <button onClick={addTask}>+ Task</button>}
   ```
2. **The backend still enforces.** Hiding a button is not security — the 403 from the API is. The UI hide is purely so users don't see buttons that would fail. **Never** rely on the frontend for authorization.

`components/Protected.tsx`:
```tsx
export function Protected({ allowed, children }: { allowed: boolean; children: ReactNode }) {
  if (!allowed) return null;
  return <>{children}</>;
}
```

## Token refresh (Day 6)

Keycloak access tokens are short-lived (default 5 min). Handle expiry in the next-auth `jwt` callback:

```ts
async jwt({ token, account }) {
  if (account) { /* initial */ return {...} }
  if (Date.now() < token.expiresAt * 1000) return token;     // still valid
  return await refreshAccessToken(token);                    // call Keycloak token endpoint with refresh_token
}
```

`refreshAccessToken` POSTs `grant_type=refresh_token` to Keycloak. On failure, mark the token with an error so the UI forces re-login. This is the graceful-expiry requirement from Day 6.

> Note: Keep the frontend genuinely minimal. The brief is explicit: Tailwind + simple components. Spend your remaining time understanding the auth flow, not polishing the board.
