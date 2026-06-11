# 01 — Architecture

## The one idea this whole project teaches

> **Authentication** (Keycloak) and **Authorization** (OpenFGA) are different problems and should be solved by different systems.

```
Keycloak  →  "Is this token valid? Who is this user?"        (identity)
OpenFGA   →  "Can THIS user do THIS action on THIS object?"  (permission)
```

A JWT can carry *who you are*. It should **not** carry *what you can do on every resource* — that list is unbounded, changes constantly, and leaks org structure into a token. OpenFGA answers permission questions at request time against a live relationship graph instead.

## Component map

```
                         ┌──────────────────────────────┐
                         │          Browser              │
                         │   Next.js (App Router)        │
                         │   - next-auth (Keycloak OIDC) │
                         │   - TanStack Query / Zustand  │
                         └───────────────┬───────────────┘
                                         │  Bearer <JWT>
                                         ▼
┌────────────┐   OIDC    ┌──────────────────────────────┐
│  Keycloak  │◀─────────▶│         FastAPI backend       │
│  realm:    │  discovery│                                │
│  devboard  │  + JWKS   │  middleware: validate JWT      │
└────────────┘           │  dependency: check_permission │──┐
                         │  routers: orgs/projects/tasks  │  │ check()
                         └───────┬───────────────┬────────┘  │
                                 │               │           ▼
                                 │ SQL           │      ┌──────────┐
                                 ▼               │      │ OpenFGA  │
                          ┌────────────┐         │      │  store   │
                          │ PostgreSQL │         │      └────┬─────┘
                          │ orgs/proj/ │         │           │ tuples
                          │ tasks/users│         │           ▼
                          └────────────┘         │      ┌──────────┐
                                                 └─────▶│  Redis    │
                                                  cache │ authz:*   │
                                                        └──────────┘
```

- **PostgreSQL** is the source of truth for *business data* (org names, task titles, statuses).
- **OpenFGA** is the source of truth for *relationships* (who is editor of what). It is NOT your app database.
- **Redis** caches `check()` answers so you don't hit OpenFGA on every request for the same question.

> Note: A subtle but important rule — **the same fact lives in two places**. When you add a user to a project, you write a row to Postgres (so the UI can list members) *and* a tuple to OpenFGA (so checks work). Day 3 introduces a helper that keeps these in sync. Treat OpenFGA writes as part of the same logical transaction as the DB write.

## Request lifecycle (the trace you'll build on Day 5)

Editing a task — `PATCH /tasks/{id}`:

```
1. Browser sends request with Authorization: Bearer <JWT>
2. FastAPI middleware:
     - fetches Keycloak JWKS (cached), verifies signature, exp, iss, aud
     - extracts sub (user id), email, preferred_username
     - rejects → 401 if invalid / expired / wrong realm
3. Route handler resolves task → finds parent project_id
4. check_permission dependency asks:
     check(user="user:<sub>", relation="can_edit", object="task:<id>")
     - Redis lookup authz:<sub>:can_edit:task:<id>
        - HIT  → use cached bool
        - MISS → call OpenFGA, store result with 30s TTL
     - false → 403 Forbidden
5. Handler runs the UPDATE against Postgres
6. structlog emits the full decision path; OTEL span records each hop
7. 200 OK
```

Every numbered step is a place a request can be legitimately rejected. **Understanding why each rejection happens is the actual deliverable of the week.**

## Layering inside the backend

```
routers/     HTTP surface. Parse input, call services, shape responses.
             Declares authz via Depends(require("can_edit", "task"))
   │
services/    Business logic. Orchestrates DB + OpenFGA writes together.
   │         e.g. add_member() writes the member row AND the tuple.
   │
repositories/ (or models/ + db session) Pure data access. No authz, no HTTP.
   │
core/        config, auth.py (JWT), authz.py (OpenFGA client + cache)
```

Keep authz **out** of repositories and **out** of services where possible — enforce it at the router boundary as a dependency. Services may still write tuples, but they should never be the gate that decides "is this allowed."

> (decision) For a one-week build you can collapse `services/` into the routers and keep `models/` thin. The brief's structure (no explicit services layer) is fine. This doc shows the fuller shape so you know what you're collapsing.

## Trust boundaries

| Boundary | What's trusted | What's verified |
|---|---|---|
| Browser → FastAPI | nothing | JWT signature + claims on every request |
| FastAPI → OpenFGA | network is internal (compose) | nothing extra; OpenFGA is authoritative for relations |
| FastAPI → Postgres | network is internal | app enforces tenant scoping in queries |
| JWT claims | identity only (`sub`, email) | **never** trust roles/permissions from the token |

The last row is the whole point: **the token tells you who, OpenFGA tells you what.**

## Why not just RBAC / JWT claims? (read before Day 3)

- **Roles in the token go stale.** Revoke someone's editor access and their existing token still claims it until expiry. OpenFGA checks are live.
- **Roles don't model resource hierarchy.** "editor on project X, viewer on project Y, admin of org Z" is awkward as flat claims and explodes the token. It's natural as tuples.
- **Derived permissions.** A task's `can_edit` is *computed* from the parent project's `editor` relation. OpenFGA does this graph traversal for you; RBAC can't without you hand-coding it everywhere.

This is **ReBAC** (Relationship-Based Access Control), the model behind Google Zanzibar. See [03-AUTHORIZATION.md](./03-AUTHORIZATION.md).
