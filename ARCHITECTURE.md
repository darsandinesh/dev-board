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
type platform  admin:[user]                                  # platform-admin
type org       platform:[platform]
               admin:[user] or admin from platform           # tenant-admin (+ platform)
               member:[user] or admin
type project   org:[org]
               owner:[user] or admin from org                 # "Admin" (+ tenant/platform)
               editor:[user] or owner                         # "Developer"
               viewer:[user] or editor                        # private — explicit only
type task      project:[project];  assignee:[user]
               can_edit: editor from project
               can_view: editor from project or assignee      # viewer => assigned only
```

**The five roles** map across three tiers:

| Role | Tier | OpenFGA |
|---|---|---|
| **platform-admin** | platform | `platform#admin` (Keycloak realm role → synced tuple) — cascades everywhere |
| **tenant-admin** | org | `org#admin` — full tenant access incl. every project (`admin from org`) |
| **Admin** | project | `project#owner` — manage project, members, tasks |
| **Developer** | project | `project#editor` — create/update tasks |
| **viewer** | project/task | `project#viewer` + sees only tasks where they're the `assignee` |

Two properties to note:
- **Projects are private**: `viewer` needs an explicit project tuple. Org
  membership alone grants nothing — but **admins cascade**: a tenant-admin (and
  any platform-admin) is `owner` of every project in the tenant via
  `admin from org` / `admin from platform`. To bootstrap usability, each org
  auto-creates a **default "General" project** and new members are auto-added as
  editors.
- **Assignment-based task visibility**: editors+ see every task; a plain viewer
  sees only tasks assigned to them (`can_view: editor from project or assignee`).
  Tenant creation is **platform-admin only**.

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

3. **Org-wide visibility as an option.** Projects are now private (explicit
   membership only). A useful enhancement would be a per-project visibility flag
   that re-enables `or member from org` for projects an org wants open to all
   members — letting each project choose private vs. org-visible instead of one
   global rule.
```
