# 10 — Folder Structure

The complete repository layout, reflecting every file referenced across docs 01–09. The original brief's tree is the minimum; this is the full picture. Files marked `(opt)` are nice-to-have, not required for the one-week build.

## Top level

```
devboard/
├── docker-compose.yml          # all services (doc 05)
├── .env                        # shared/dev env (gitignored)
├── .gitignore
├── README.md                   # repo readme (Day 7)
├── ARCHITECTURE.md             # written Day 7 (lift from docs/01)
├── Makefile                    # (opt) shortcuts: up, down, bootstrap, test, migrate
├── docs/                       # ← these design docs (already exist)
│   ├── 00-INDEX.md  …  10-FOLDER-STRUCTURE.md
│   └── Readme.md
├── backend/                    # FastAPI service
├── frontend/                   # Next.js app
└── infra/                      # service config + bootstrap
```

## `backend/`

```
backend/
├── pyproject.toml              # deps (fastapi, sqlalchemy[asyncio], asyncpg,
│                               #   alembic, openfga-sdk, python-jose/pyjwt,
│                               #   redis, structlog, opentelemetry-*, pydantic-settings)
├── Dockerfile
├── .env                        # backend env (doc 05) — gitignored
├── .env.example                # committed template
├── alembic.ini
├── alembic/
│   ├── env.py                  # async; imports Base.metadata
│   └── versions/
│       └── 0001_initial_schema.py
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app, router mounting, middleware, OTEL init
│   │
│   ├── core/
│   │   ├── config.py           # pydantic-settings, reads .env (doc 05)
│   │   ├── auth.py             # JWT validation: JWKS fetch+cache, verify, current_user (doc 01/05)
│   │   ├── authz.py            # Authz class (check/write/delete) + require() dependency (doc 03)
│   │   ├── logging.py          # structlog setup (doc, Day 5)
│   │   └── telemetry.py        # OpenTelemetry spans setup (Day 5)
│   │
│   ├── db/
│   │   ├── session.py          # async engine + session dependency (doc 02)
│   │   └── base.py             # DeclarativeBase + pk() helper (doc 02)
│   │
│   ├── models/                 # SQLAlchemy ORM (doc 02)
│   │   ├── __init__.py         # import all models so Alembic sees them
│   │   ├── user.py
│   │   ├── org.py              # Org + OrgMember + org_role enum
│   │   ├── project.py          # Project + ProjectMember + project_role enum
│   │   └── task.py             # Task + task_status enum
│   │
│   ├── schemas/                # Pydantic request/response models (doc 04)
│   │   ├── org.py
│   │   ├── project.py
│   │   ├── task.py
│   │   └── common.py           # shared (paginated, member, me, permissions)
│   │
│   ├── services/               # business logic; dual-writes DB + OpenFGA tuples (doc 01/03)
│   │   ├── org_service.py
│   │   ├── project_service.py
│   │   └── task_service.py
│   │   #  (opt) for the week you may inline these into routers — see doc 01 (decision)
│   │
│   └── routers/                # HTTP surface, declares authz via Depends(require(...)) (doc 04)
│       ├── me.py               # GET /me, GET /me/permissions
│       ├── orgs.py             # /orgs + /orgs/{id}/members
│       ├── projects.py         # /projects + /projects/{id}/members
│       └── tasks.py            # /tasks
│
└── tests/                      # doc 07
    ├── conftest.py             # fixtures: test DB, OpenFGA store, test-JWT keypair, client, seed
    ├── helpers.py              # make_token(), bearer(), seed.* (writes row + tuple)
    ├── test_auth_matrix.py     # the 13 must-pass cases
    ├── test_orgs.py
    ├── test_projects.py
    └── test_tasks.py
```

> Note: `models/` (DB rows) and `schemas/` (API shapes) are separate on purpose — never return ORM objects directly. `services/` is where the DB write and the OpenFGA tuple write happen together; routers stay thin and just enforce `require(...)`.

## `frontend/`

```
frontend/
├── package.json                # next, next-auth, @tanstack/react-query, zustand, tailwindcss
├── Dockerfile
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── .env.local                  # frontend env (doc 05) — gitignored
├── .env.local.example
├── app/                        # App Router (doc 06)
│   ├── layout.tsx              # SessionProvider + QueryClientProvider
│   ├── globals.css
│   ├── page.tsx                # "/" project list
│   ├── providers.tsx           # client wrapper for the providers
│   ├── projects/
│   │   └── [id]/
│   │       ├── page.tsx        # Kanban board
│   │       └── settings/
│   │           └── page.tsx    # member roles (owner/admin only)
│   └── api/
│       └── auth/
│           └── [...nextauth]/
│               └── route.ts    # next-auth handler
├── lib/
│   ├── auth.ts                 # next-auth Keycloak provider config + token refresh (doc 06)
│   ├── api.ts                  # authedFetch + TanStack hooks (useProjects, useTasks, …)
│   └── store.ts                # Zustand stores (selected project, filters, drag state)
├── components/
│   ├── Board.tsx
│   ├── Column.tsx
│   ├── TaskCard.tsx
│   ├── MemberTable.tsx
│   ├── ProjectList.tsx
│   └── Protected.tsx           # hides UI by permission (doc 06)
└── types/
    └── next-auth.d.ts          # augments Session with accessToken
```

## `infra/`

```
infra/
├── postgres/
│   └── init-dbs.sql            # CREATE DATABASE keycloak; CREATE DATABASE openfga; (doc 05)
├── keycloak/
│   └── realm-export.json       # devboard realm: client + audience mapper + test users (doc 05)
└── openfga/
    ├── model.fga               # the authorization model (doc 03)
    └── bootstrap.sh            # create store + write model, print store_id/model_id (doc 03/05)
```

## How this maps to the brief's tree

The original `Readme.md` tree is a subset. This expands it with:

- `schemas/` — split from `models/` (API shapes vs DB rows).
- `services/` — explicit dual-write layer (doc 01 says you *may* collapse this into routers for the week).
- `core/logging.py` + `core/telemetry.py` — the Day-5 observability pieces.
- `tests/` — the Day-6 auth matrix.
- `infra/postgres/` + `infra/openfga/bootstrap.sh` — the setup glue the brief assumes but doesn't list.
- `frontend/components/`, `lib/store.ts`, `types/next-auth.d.ts` — the concrete files doc 06 references.

## Minimum viable subset (if you're short on time)

If you want the smallest tree that still hits the learning goals, you can drop:

- `services/` → inline into routers.
- `core/telemetry.py` → Day 5 is partly optional; keep `logging.py`, defer OTEL.
- `frontend/` polish → keep `app/`, `lib/`, and `Protected.tsx`; skip extra components.

Everything in `core/auth.py`, `core/authz.py`, `infra/openfga/`, and `tests/test_auth_matrix.py` is **non-negotiable** — that's where the project's value lives.
