# DevBoard — Architecture

A multi-tenant task manager (orgs → projects → Kanban tasks) built to learn one
idea deeply:

> **Authentication and authorization are different problems, solved by different systems.**
> Keycloak answers *"who is this?"*; OpenFGA answers *"can this user do this to this object?"*

A JWT carries *identity* (`sub`, email, username). It deliberately does **not**
carry permissions — those live in OpenFGA's relationship graph and are checked
live at request time, so a revoked grant takes effect immediately rather than
lingering until the token expires.

## Components

```
                         ┌──────────────────────────────┐
                         │          Browser              │
                         │   Next.js (App Router) :3001  │
                         │   next-auth (Keycloak OIDC)   │
                         │   TanStack Query / Zustand    │
                         └───────────────┬───────────────┘
                                         │  Authorization: Bearer <JWT>
                                         ▼
┌────────────┐   OIDC    ┌──────────────────────────────┐
│  Keycloak  │◀─────────▶│        FastAPI backend :8000  │
│  realm:    │ discovery │                                │
│  devboard  │ + JWKS    │  auth.py     validate JWT      │
└────────────┘           │  authz.py    require()/check() │──┐ check()
                         │  routers     orgs/projects/tasks│  │
                         └──────┬──────────────────┬───────┘  ▼
                                │ SQL              │     ┌──────────┐
                                ▼                  │     │ OpenFGA  │ relationships
                         ┌────────────┐            │     │  store   │ (tuples)
                         │ PostgreSQL │            │     └────┬─────┘
                         │ business   │            │          │
                         │ data       │            └─────────▶├──────────┐
                         └────────────┘          cache 30s    │  Redis   │ authz:*
                                                               └──────────┘
```

- **PostgreSQL** — source of truth for *business data* (org/project/task rows).
- **OpenFGA** — source of truth for *relationships* (who is admin/owner/editor/
  viewer of what). Not the app database.
- **Redis** — caches `check()` answers (key `authz:{user}:{relation}:{object}`,
  30 s TTL) and is wiped per-user on any tuple change.

The same fact lives in two places: adding a member writes a Postgres row (so the
UI can list members) **and** an OpenFGA tuple (so checks resolve). The routers
do both in one request; if the tuple write fails the DB transaction rolls back.

## Request lifecycle — `PATCH /tasks/{id}`

```
1. Browser → Authorization: Bearer <JWT>
2. auth.py: fetch Keycloak JWKS (cached 5m), verify signature/exp/iss/aud,
            extract sub/email/username           ── span: jwt.validate ──▶ 401 on failure
3. require("can_edit","task","task_id") dependency:
     check(user="user:<sub>", relation="can_edit", object="task:<id>")
       Redis authz:<sub>:can_edit:task:<id>
         HIT  → cached bool
         MISS → OpenFGA check, store 30s          ── span: openfga.check ──▶ 403 on deny
4. handler UPDATEs the task row in Postgres        ── span: db (SQLAlchemy) ──▶ 404 if missing
5. structlog emits one line with correlation_id + decision path; OTEL trace
   nests the three spans above
6. 200 OK
```

Every numbered step is a place the request can be legitimately rejected (401 →
403 → 404). Naming each rejection point is the deliverable.

## Authorization flow (login + a permission check)

```
 ┌─────────┐   1. click "Sign in"        ┌──────────┐
 │ Browser │ ──────────────────────────▶ │ next-auth│
 └─────────┘                             └────┬─────┘
      ▲                                       │ 2. OIDC redirect
      │ 6. session cookie + access_token      ▼
      │                              ┌──────────────┐
      │  3. login (alice/****)       │   Keycloak   │
      │ ───────────────────────────▶ │ realm devboard│
      │  4. code → tokens            └──────┬───────┘
      │ ◀───────────────────────────────────┘
      │
      │ 7. fetch /tasks?project_id=…  Authorization: Bearer <access_token>
      ▼
 ┌──────────────┐  8. verify JWT (Keycloak JWKS)          ┌──────────┐
 │   FastAPI    │  9. check(user:alice, viewer, project)  │ OpenFGA  │
 │              │ ──────────────────────────────────────▶ │  graph   │
 │              │ ◀──────── allowed? true/false ───────────│ traversal│
 └──────────────┘ 10. 200 with tasks, or 403              └──────────┘
```

The OpenFGA model (`infra/openfga/model.fga`):

```
type user
type org      admin:[user];  member:[user] or admin
type project  org:[org];  owner:[user];  editor:[user] or owner
              viewer:[user] or editor or member from org
type task     project:[project];  can_edit: editor from project
                                   can_view: viewer from project
```

`viewer: ... or member from org` is why **an org admin can view any project in
their org with no project-level tuple** — the check traverses
`project → org → member (← admin)`. And `can_edit: editor from project` means a
task's edit permission is *computed* from the parent project, so moving a task
between projects re-derives all permissions by rewriting one tuple.

## Why ReBAC, not roles-in-the-JWT

- **Stale grants.** A role baked into a token stays valid until expiry; revoking
  it does nothing until then. OpenFGA checks are live (and we wipe the Redis
  cache on revoke — see test case 13).
- **Resource hierarchy.** "editor on X, viewer on Y, admin of org Z" is awkward
  as flat claims and bloats the token; it's natural as tuples.
- **Derived permissions.** `can_edit` on a task is computed from the project's
  `editor` relation — graph traversal OpenFGA does for you, which RBAC can't
  without hand-coded checks everywhere.

Trust boundary, stated once: **the token tells you who; OpenFGA tells you what.**
JWT claims are never trusted for permissions.

## Three things I'd do differently at scale

1. **Postgres ↔ OpenFGA sync via the outbox pattern.** Today the tuple write
   happens inline in the request handler (DB flush → tuple write → commit). A
   crash between the tuple write and the commit can orphan a tuple. At scale I'd
   write an outbox row in the same DB transaction and have a worker ship tuples
   to OpenFGA with retries — exactly-once-ish instead of best-effort.

2. **Smarter cache invalidation.** We wipe the whole `authz:{user}:*` namespace
   on any tuple change for that user, and rely on a 30 s TTL as a backstop. A
   role change can also affect *other* users (org-structure changes). I'd compute
   the affected set and invalidate precisely, or subscribe to OpenFGA's changelog.

3. **Private projects.** The model grants every org member `viewer` on every
   project (`or member from org`). For truly private projects I'd drop that
   clause and grant viewers explicitly — a one-line model change with a big
   blast radius, so it belongs behind a per-project visibility flag.
```
