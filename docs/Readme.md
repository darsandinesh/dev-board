# DevBoard — Multi-Tenant Task Manager with Fine-Grained Authorization

> A one-week full-stack build to deeply understand Keycloak (AuthN) + OpenFGA (AuthZ) through a real working product.

---

## Project Summary

DevBoard is a lightweight project management tool where teams organize work across orgs, projects, and tasks. The learning focus is not the task management itself — it's building a production-grade auth layer where **Keycloak handles identity** and **OpenFGA handles fine-grained permissions** on every resource.

---

## The Core Insight You'll Build Toward

```
Keycloak answers: "Is this token valid? Who is this user?"
OpenFGA answers:  "Is this user allowed to do THIS ACTION on THIS RESOURCE?"
```

By the end of the week, you'll have written and understood this pattern:

```python
async def can_edit_task(user_id: str, task_id: str) -> bool:
    return await openfga.check(
        user=f"user:{user_id}",
        relation="editor",
        object=f"task:{task_id}"
    )
```

And you'll know *why* this is more powerful than JWT claims or flat role-based access control.

---

## Domain Model

```
Org
 └── Project
      └── Task
```

- A user belongs to an **Org** with a role: `admin` or `member`
- A user can be assigned to a **Project** as: `owner`, `editor`, or `viewer`
- **Task** permissions are derived from the parent project relationship
- Permission checks are **relationship-based**, not claim-based

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL |
| Auth (Identity) | Keycloak (OIDC/OAuth2/JWT) |
| Auth (Authorization) | OpenFGA |
| Caching | Redis (OpenFGA result cache) |
| Frontend | Next.js, TanStack Query, Zustand, Tailwind CSS |
| Infra | Docker Compose |
| Observability | structlog, OpenTelemetry |

---

## Day-by-Day Plan

### Day 1 — Foundation & Infrastructure

**Goal:** All services running, Keycloak login working, FastAPI validating tokens.

Tasks:
- Write `docker-compose.yml` with PostgreSQL, Keycloak, OpenFGA
- Configure Keycloak: create realm (`devboard`), client (`devboard-app`), and a test user
- Scaffold FastAPI project structure
- Write JWT middleware that validates Keycloak-issued tokens on every request
- Smoke test: hit a protected endpoint with a valid token, get 200; with none, get 401

Deliverable: `GET /me` returns decoded user info from the Keycloak JWT.

---

### Day 2 — Data Layer & Basic CRUD

**Goal:** Models, migrations, and working API endpoints — no authz yet, just get it working.

Tasks:
- Define SQLAlchemy models: `Org`, `Project`, `Task`, `User`
- Write Alembic migrations
- Implement CRUD endpoints:
  - `POST /orgs`, `GET /orgs/{id}`
  - `POST /projects`, `GET /projects/{id}`
  - `POST /tasks`, `GET /tasks/{id}`, `PATCH /tasks/{id}`
- All endpoints require a valid JWT (from Day 1 middleware)

Deliverable: Full CRUD working in Postman/curl with Keycloak tokens.

---

### Day 3 — OpenFGA Integration *(Main Focus)*

**Goal:** Every endpoint is protected by relationship-based permission checks.

Tasks:
- Define the OpenFGA authorization model:
  ```
  type user
  type org
    relations
      define admin: [user]
      define member: [user] or admin
  type project
    relations
      define org: [org]
      define owner: [user]
      define editor: [user] or owner
      define viewer: [user] or editor or member from org
  type task
    relations
      define project: [project]
      define can_edit: editor from project
      define can_view: viewer from project
  ```
- Write a `write_tuple()` helper to create relationships when users are added to orgs/projects
- Write a `check_permission()` FastAPI dependency
- Protect every endpoint:
  - Creating a project → must be org `admin`
  - Editing a task → must be project `editor` or above
  - Viewing a task → must be project `viewer` or above
- Test: create two users, assign different roles, verify access control works

Deliverable: Unauthorized users get 403. Authorized users get through. You understand why.

---

### Day 4 — Frontend

**Goal:** A working UI with login and task management.

Tasks:
- Next.js app with Keycloak login via `next-auth` or `keycloak-js`
- Store auth session, attach JWT to all API requests
- Pages:
  - `/` — list of projects the user can see
  - `/projects/[id]` — Kanban-style task board (To Do, In Progress, Done)
  - `/projects/[id]/settings` — manage member roles (admin only)
- TanStack Query for all data fetching
- Zustand for local UI state (selected project, active filters)
- Hide edit/delete buttons for users who only have `viewer` role

Deliverable: Full UI flow — login → see projects → manage tasks.

---

### Day 5 — Redis Caching + Observability

**Goal:** Make the app production-aware.

Tasks:
- Cache OpenFGA `check()` results in Redis with a short TTL (e.g. 30 seconds)
  - Key pattern: `authz:{user_id}:{relation}:{resource_id}`
  - Invalidate on tuple writes (when roles change)
- Add `structlog` structured logging to all API endpoints
- Add OpenTelemetry traces to:
  - JWT validation
  - OpenFGA permission checks
  - Database queries
- Log the full auth decision path on each request

Deliverable: You can see a trace showing: token validated → permission checked (cache hit or miss) → query executed.

---

### Day 6 — Harden & Connect

**Goal:** End-to-end flow works cleanly and edge cases are handled.

Tasks:
- Handle token expiry gracefully (frontend refresh, backend 401 response)
- Add proper error responses: 401 Unauthorized, 403 Forbidden, 404 Not Found
- Write integration tests for critical auth flows:
  - Valid token + correct role → 200
  - Valid token + wrong role → 403
  - No token → 401
  - Token from wrong realm → 401
- End-to-end test: login → create org → create project → invite member → verify member access

Deliverable: The app handles auth failures cleanly at every layer.

---

### Day 7 — Reflect & Document

**Goal:** Consolidate what you've learned.

Tasks:
- Write `ARCHITECTURE.md` covering:
  - How Keycloak and OpenFGA fit together
  - The request lifecycle: browser → Next.js → FastAPI → OpenFGA → DB
  - Why relationship-based authz is better than RBAC for this use case
- Draw the auth flow diagram (even a rough ASCII version)
- Note 3 things you'd do differently at real scale
- Push to GitHub with a clean README

---

## Project Structure

```
devboard/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── auth.py          # JWT validation (Keycloak)
│   │   │   └── authz.py         # OpenFGA permission checks
│   │   ├── models/
│   │   │   ├── org.py
│   │   │   ├── project.py
│   │   │   └── task.py
│   │   ├── routers/
│   │   │   ├── orgs.py
│   │   │   ├── projects.py
│   │   │   └── tasks.py
│   │   └── db/
│   │       └── session.py
│   ├── alembic/
│   └── pyproject.toml
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # Project list
│   │   ├── projects/[id]/
│   │   │   ├── page.tsx         # Task board
│   │   │   └── settings/
│   │   └── auth/
│   ├── lib/
│   │   ├── api.ts               # TanStack Query hooks
│   │   └── store.ts             # Zustand stores
│   └── package.json
├── infra/
│   ├── keycloak/
│   │   └── realm-export.json    # Keycloak realm config
│   └── openfga/
│       └── model.fga            # Authorization model
└── ARCHITECTURE.md
```

---

## Key Rules for the Week

1. **Don't skip Day 3.** The OpenFGA model is the whole point. If it feels hard, that's the learning happening.
2. **Test auth failures as much as successes.** A 403 you understand is worth more than a 200 you don't.
3. **Don't over-engineer the UI.** Tailwind + simple components is enough. The frontend is a vehicle, not the destination.
4. **Commit at the end of each day.** You want to see your progress and be able to roll back.

---

## What You'll Walk Away With

- A real working understanding of the OIDC/OAuth2 flow — not just "it works"
- Hands-on experience writing an OpenFGA authorization model from scratch
- A pattern for permission-aware API design you can apply to any project
- A full-stack application in your portfolio that demonstrates auth depth
- Confidence to say you've *actually used* Keycloak and OpenFGA, not just listed them
