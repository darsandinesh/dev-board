# 08 — Task Breakdown

Every day decomposed into checkbox-level tickets with **acceptance criteria** (AC). This is your daily driver. Each ticket links to the deep-dive doc that explains it.

Legend: `□` todo · effort in (S)mall / (M)edium / (L)arge · 🔑 = critical-path, don't skip.

---

## Day 0 — Prep (optional, ~30 min)

- □ (S) Install tooling: Docker, `uv` or `poetry`, Node 20+, `fga` CLI, `jq`.
- □ (S) Create repo, add `.gitignore` (Python + Node), commit the `docs/` folder.
- □ (S) Create top-level dirs: `backend/`, `frontend/`, `infra/{postgres,keycloak,openfga}/`.

---

## Day 1 — Foundation & Infrastructure
Goal: all services up, Keycloak login works, FastAPI validates tokens. → [05-INFRASTRUCTURE.md](./05-INFRASTRUCTURE.md)

- □ 🔑 (M) Write `docker-compose.yml` with postgres, keycloak, openfga(+migrate), redis.
  - AC: `docker compose up postgres keycloak openfga redis` → all healthy, no restart loops.
- □ (S) `infra/postgres/init-dbs.sql` creates `keycloak` and `openfga` databases.
  - AC: `\l` in psql shows `devboard`, `keycloak`, `openfga`.
- □ 🔑 (M) Configure Keycloak: realm `devboard`, client `devboard-app` (confidential, redirect URIs), audience mapper.
  - AC: admin console shows the client; token endpoint issues a JWT with `aud=devboard-app`.
- □ (S) Create 4 test users (alice, bob, carol, dave) with permanent passwords.
  - AC: direct-grant curl returns an access token for each.
- □ (S) Export realm to `infra/keycloak/realm-export.json`; verify `--import-realm` recreates it from scratch.
  - AC: `docker compose down -v && up` rebuilds the realm with users.
- □ 🔑 (M) Scaffold FastAPI: `app/main.py`, `core/config.py` (pydantic-settings reading `.env`), health route.
  - AC: `GET /health` → 200.
- □ 🔑 (L) Write JWT middleware/dependency in `core/auth.py`: fetch JWKS (cached), verify signature/exp/iss/aud, extract `sub`/email/username.
  - AC: see smoke test below.
- □ 🔑 (S) Implement `GET /me`.
  - AC (Day-1 gate): valid token → 200 with decoded user; no token → 401; garbage → 401; wrong-issuer token → 401.
- □ (S) **Commit:** "Day 1: infra + JWT validation".

---

## Day 2 — Data Layer & CRUD (no authz yet)
Goal: models, migrations, working endpoints behind JWT only. → [02-DATA-MODEL.md](./02-DATA-MODEL.md), [04-API-SPEC.md](./04-API-SPEC.md)

- □ 🔑 (M) Define SQLAlchemy models: `User`, `Org`, `OrgMember`, `Project`, `ProjectMember`, `Task` (+ enums).
  - AC: `Base.metadata` imports cleanly; types resolve.
- □ (S) Set up async engine + session dependency in `db/session.py`.
  - AC: a trivial `SELECT 1` works through the session.
- □ 🔑 (M) Alembic async setup; autogenerate "initial schema"; `upgrade head`.
  - AC: all 6 tables + enums exist in `devboard` DB; FKs present.
- □ (S) Lazy user upsert: on each authed request, upsert `users` by `keycloak_sub`.
  - AC: first call by alice creates a row; second call doesn't duplicate.
- □ 🔑 (L) Implement CRUD (JWT-gated only, no permission checks yet):
  - □ `POST /orgs`, `GET /orgs/{id}`, `GET /orgs/{id}/members`, `POST /orgs/{id}/members`
  - □ `POST /projects`, `GET /projects`, `GET /projects/{id}`, `POST /projects/{id}/members`
  - □ `POST /tasks`, `GET /tasks?project_id`, `GET /tasks/{id}`, `PATCH /tasks/{id}`, `DELETE /tasks/{id}`
  - AC: full create→read→update→delete cycle works via curl/Postman with a valid token.
- □ (S) Pydantic request/response schemas for each.
  - AC: invalid body → 422.
- □ (S) **Commit:** "Day 2: data layer + CRUD".

> Note: Resist adding authz today. Getting CRUD solid first means Day 3 is *purely* about OpenFGA, which is the learning.

---

## Day 3 — OpenFGA Integration 🔑🔑 (the whole point)
Goal: every endpoint gated by relationship checks. → [03-AUTHORIZATION.md](./03-AUTHORIZATION.md)

- □ 🔑 (S) Write `infra/openfga/model.fga` (the model from doc 03).
  - AC: `fga model write` accepts it without error.
- □ 🔑 (S) `infra/openfga/bootstrap.sh`: create store + write model, print `store_id` + `model_id`; put them in `.env`.
  - AC: re-running `check` from the CLI against the store returns answers.
- □ 🔑 (M) `core/authz.py`: `Authz` class with `check()`, `write()`, `delete()` (cache wiring can be stubbed today, real in Day 5).
  - AC: a manual `check(user:alice, admin, org:X)` returns the expected bool.
- □ 🔑 (M) Wire tuple writes into the mutating endpoints (the table in [03 → Tuple lifecycle](./03-AUTHORIZATION.md#tuple-lifecycle--who-writes-what-when)):
  - □ create org → admin tuple
  - □ add org member → member/admin tuple
  - □ create project → `project→org` tuple + owner tuple
  - □ add project member → role tuple
  - □ create task → `task→project` tuple
  - □ role change → delete old + write new tuple
  - AC: after creating data, the tuples are visible in the OpenFGA Playground.
- □ 🔑 (L) `require(relation, obj_type)` dependency; attach to every endpoint per the [authz quick-reference table](./04-API-SPEC.md#endpoint--authz-quick-reference).
  - AC: each endpoint returns 403 when the relation is missing.
- □ 🔑 (M) Run the [check test cases](./03-AUTHORIZATION.md#test-cases-that-prove-you-understand-it-day-3--day-6) by hand with two+ users.
  - AC: org-admin can view an org project with **no** project tuple, and you can explain why (member-from-org traversal).
- □ (M) Implement listing for `GET /projects` (list-then-check first; `ListObjects` if time).
  - AC: each user sees exactly the projects they should.
- □ (S) **Commit:** "Day 3: OpenFGA authz on all endpoints".

**Day-3 gate:** two users with different roles → unauthorized gets 403, authorized gets through, and you can articulate the traversal for each decision.

---

## Day 4 — Frontend
Goal: login + task management UI. → [06-FRONTEND.md](./06-FRONTEND.md)

- □ 🔑 (M) Scaffold Next.js (App Router, TS, Tailwind); providers in `layout.tsx`.
  - AC: blank app runs at :3000.
- □ 🔑 (L) next-auth Keycloak provider; stash Keycloak `access_token` on the session.
  - AC: clicking login → Keycloak → redirected back authenticated; session has an access token.
- □ 🔑 (M) `lib/api.ts`: authed fetch attaching `Bearer`; TanStack hooks (`useProjects`, `useTasks`, `useUpdateTask`, mutations).
  - AC: `/` lists the logged-in user's projects from the real backend.
- □ (M) `/projects/[id]` Kanban board: 3 columns, cards, drag→PATCH status/position (optimistic).
  - AC: dragging a card persists across reload.
- □ (M) `/projects/[id]/settings`: member table with role management (owner/admin only).
  - AC: changing a role calls the API and updates tuples (verify in Playground).
- □ 🔑 (S) Permission-aware UI: hide edit/delete/add for viewers via `/me/permissions` or `my_role`.
  - AC: a viewer sees a read-only board; an editor sees action buttons.
- □ (S) **Commit:** "Day 4: frontend".

---

## Day 5 — Caching + Observability
Goal: production-aware app. → [03 → Caching](./03-AUTHORIZATION.md#caching--invalidation-day-5), [01 → Request lifecycle](./01-ARCHITECTURE.md#request-lifecycle-the-trace-youll-build-on-day-5)

- □ 🔑 (M) Redis cache in `Authz.check()`: key `authz:{user}:{relation}:{object}`, 30s TTL.
  - AC: second identical check is a cache hit (verify with a log/metric or Redis MONITOR).
- □ 🔑 (M) Invalidate `authz:{user}:*` on tuple write/delete (role changes).
  - AC: demote a user → their next check misses cache and returns the new (denied) answer immediately.
- □ (M) `structlog` structured logging on every request; log the full auth decision path (token validated → relation checked → cache hit/miss → allowed).
  - AC: one request produces one coherent structured log line/group with `user_id`, `relation`, `object`, `decision`, `cache`.
- □ (M) OpenTelemetry spans around: JWT validation, OpenFGA check, DB query.
  - AC: a trace (console exporter or Jaeger) shows the three nested spans for one request.
- □ (S) **Commit:** "Day 5: cache + observability".

**Day-5 gate:** you can produce a trace showing token validated → permission checked (hit or miss) → query executed.

---

## Day 6 — Harden & Connect
Goal: clean end-to-end, edge cases handled. → [07-TESTING.md](./07-TESTING.md), [06 → Token refresh](./06-FRONTEND.md#token-refresh-day-6)

- □ 🔑 (M) Frontend token refresh in next-auth `jwt` callback; force re-login on refresh failure.
  - AC: leave the app idle past access-token expiry → next action silently refreshes, no error.
- □ (S) Consistent error responses across backend: 401 / 403 / 404 / 422 with clear bodies.
  - AC: each status is reachable and shaped consistently.
- □ 🔑 (L) Write the [auth test matrix](./07-TESTING.md#the-auth-test-matrix-must-pass) (cases 1–13) as integration tests; test JWTs minted with a local keypair; real OpenFGA + Postgres.
  - AC: all 13 cases green.
- □ 🔑 (M) E2E flow by hand: login → create org → project → invite member → verify member access → demote → verify 403.
  - AC: the full flow works through the UI.
- □ (S) **Commit:** "Day 6: hardening + tests".

---

## Day 7 — Reflect & Document
Goal: consolidate. → original [Readme.md](./Readme.md)

- □ (M) Write `ARCHITECTURE.md` at repo root: Keycloak+OpenFGA fit, request lifecycle, why ReBAC > RBAC here. (Can lift from [01](./01-ARCHITECTURE.md).)
- □ (S) Auth flow diagram (ASCII is fine — reuse [01's](./01-ARCHITECTURE.md#component-map)).
- □ (S) "3 things I'd do differently at scale" — candidates already flagged in the docs:
  - Postgres↔OpenFGA sync via outbox pattern instead of inline writes ([03 note](./03-AUTHORIZATION.md#tuple-lifecycle--who-writes-what-when)).
  - Smarter cache invalidation (affected-set, not just per-user) ([03 caching note](./03-AUTHORIZATION.md#caching--invalidation-day-5)).
  - Private projects (drop `member from org` from `viewer`) ([03 model note](./03-AUTHORIZATION.md#why-this-model-is-elegant)).
- □ (S) Clean repo `README.md` (setup, run, screenshots).
- □ (S) **Commit + push:** "Day 7: docs".

---

## Definition of Done (the whole project)

- □ One command (`docker compose up` + bootstrap script) brings the system to life.
- □ All 13 auth-matrix tests pass.
- □ You can trace a request end-to-end and name every point it could be rejected.
- □ You can explain, to another engineer, why `org admin can view a project with no project tuple` — without looking it up.

If the last bullet is true, the week succeeded regardless of UI polish.
