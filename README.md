# DevBoard

A multi-tenant task manager — **orgs → projects → Kanban tasks** — built to learn
**Keycloak (authentication) + OpenFGA (relationship-based authorization)** end to end.

The point isn't the UI; it's that **identity and permission are separate systems**:
Keycloak says *who you are*, OpenFGA says *what you can do*, and a revoked grant
takes effect immediately. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the why.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind, next-auth (Keycloak OIDC), TanStack Query, Zustand |
| Backend | FastAPI (async), SQLAlchemy 2 + asyncpg, Alembic, openfga-sdk, structlog, OpenTelemetry |
| Auth | Keycloak (OIDC, JWT) for authn · OpenFGA (Zanzibar-style ReBAC) for authz |
| Data / cache | PostgreSQL (business data) · Redis (authz decision cache) |

## Prerequisites

Docker, Python 3.12 + [`uv`](https://github.com/astral-sh/uv), Node 20+, and the
[`fga`](https://github.com/openfga/cli) CLI (`brew install openfga/tap/fga`).

> macOS note: a local Postgres often owns host `:5432`, so DevBoard's container is
> published on **`:5433`**. The dockerized backend still reaches it as
> `postgres:5432` over the compose network.

## Run it

```bash
# 1. Infrastructure (postgres, redis, keycloak, openfga + its one-shot migrate)
docker compose up -d postgres redis keycloak openfga

# 2. Initialize the OpenFGA store + model -> writes store/model ids into .env
bash infra/openfga/bootstrap.sh

# 3. Backend
cd backend
uv venv && source .venv/bin/activate
uv pip install -e ".[dev]"
alembic upgrade head                 # create the schema
uvicorn app.main:app --port 8000     # http://localhost:8000  (/docs for OpenAPI)

# 4. Frontend (new terminal)
cd frontend
cp .env.local.example .env.local     # then set NEXTAUTH_SECRET (openssl rand -base64 32)
npm install
npm run dev                          # http://localhost:3001
```

Or use the shortcuts in the [Makefile](./Makefile): `make up`, `make bootstrap`,
`make migrate`, `make backend`, `make frontend`, `make test`.

Sign in with a seeded Keycloak user: **alice / password123** (also bob, carol, dave).

## Try the flow

1. alice signs in → lands on `/`.
2. alice creates org "Acme", then project "Web" (she becomes owner).
3. alice opens the project **Settings** and adds bob as `editor`.
4. bob signs in → sees "Web" → can move task cards (drag → PATCH status).
5. alice demotes bob to `viewer` → bob's add/drag controls disappear and the API
   returns 403 on edit attempts (cache invalidated immediately).

## Tests

The 13-case auth matrix + happy-path CRUD run against **real** OpenFGA + Postgres +
Redis, with Keycloak mocked via a local keypair:

```bash
docker compose up -d postgres redis openfga
cd backend && source .venv/bin/activate && pytest -q     # 18 passed
```

Cases 1–5 prove authentication, 6–12 prove authorization, 13 proves cache
invalidation on role revocation. There's also an end-to-end script driving real
Keycloak tokens: `python scripts/day3-authz-test.py` (needs the API + Keycloak up).

## Layout

```
backend/    FastAPI app — core/{auth,authz,cache,telemetry,logging}, models,
            schemas, routers, alembic/, tests/
frontend/   Next.js app — app/, lib/{auth,api,store}, components/
infra/      postgres init, keycloak realm export, openfga model + bootstrap
docs/       the design docs this build follows (00–10)
```

## Definition of done

- ✅ One command set brings the system up (compose + bootstrap + migrate).
- ✅ All 13 auth-matrix tests pass.
- ✅ A request can be traced end to end (`jwt.validate → openfga.check → db`), and
  every rejection point (401/403/404) is nameable.
- ✅ Why *an org admin can view a project with no project tuple*: the
  `viewer: … or member from org` traversal. (`project → org → member ← admin`.)
