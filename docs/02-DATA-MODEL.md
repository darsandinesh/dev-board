# 02 — Data Model

Covers the PostgreSQL schema (business data). Relationship/permission data lives in OpenFGA — see [03-AUTHORIZATION.md](./03-AUTHORIZATION.md).

## ER diagram

```
┌──────────────┐        ┌──────────────────┐        ┌──────────────┐
│    users     │        │  org_members     │        │     orgs     │
│──────────────│        │──────────────────│        │──────────────│
│ id (uuid) PK │◀──┐    │ org_id      FK   │───────▶│ id (uuid) PK │
│ keycloak_sub │   └────│ user_id     FK   │        │ name         │
│ email        │        │ role (enum)      │        │ created_at   │
│ username     │        │  admin|member    │        └──────┬───────┘
│ created_at   │        └──────────────────┘               │
└──────┬───────┘                                            │ 1
       │                                                    │
       │        ┌──────────────────┐        ┌──────────────▼───────┐
       │        │ project_members  │        │      projects        │
       │        │──────────────────│        │──────────────────────│
       └───────▶│ project_id  FK   │───────▶│ id (uuid) PK         │
                │ user_id     FK   │        │ org_id   FK          │
                │ role (enum)      │        │ name                 │
                │ owner|editor|    │        │ description          │
                │ viewer           │        │ created_at           │
                └──────────────────┘        └──────────┬───────────┘
                                                        │ 1
                                                        │
                                            ┌───────────▼──────────┐
                                            │        tasks         │
                                            │──────────────────────│
                                            │ id (uuid) PK         │
                                            │ project_id  FK       │
                                            │ title                │
                                            │ description          │
                                            │ status (enum)        │
                                            │  todo|in_progress|   │
                                            │  done                │
                                            │ assignee_id FK→users │
                                            │ position (int)       │
                                            │ created_at           │
                                            │ updated_at           │
                                            └──────────────────────┘
```

## Tables

### `users`
Mirror of Keycloak identities. We store a local row so we can FK to it and show names without calling Keycloak.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | app-local id |
| `keycloak_sub` | text unique | the `sub` claim from the JWT — the join key to identity |
| `email` | text | from token, kept in sync on login |
| `username` | text | `preferred_username` |
| `created_at` | timestamptz | |

> Note: A user row is created lazily on first authenticated request (upsert by `keycloak_sub`). You don't pre-provision users — Keycloak owns the user list; this table is a cache/FK target.

### `orgs`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | also the OpenFGA `org:<id>` object id |
| `name` | text | |
| `created_at` | timestamptz | |

### `org_members`
The DB-side mirror of org membership. (OpenFGA holds the authoritative `admin`/`member` tuples; this table powers the members list UI.)

| Column | Type | Notes |
|---|---|---|
| `org_id` | uuid FK | |
| `user_id` | uuid FK | |
| `role` | enum `org_role` (`admin`,`member`) | |
| composite PK | `(org_id, user_id)` | one role per user per org |

### `projects`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | OpenFGA `project:<id>` |
| `org_id` | uuid FK → orgs | parent org; powers `viewer ... from org` |
| `name` | text | |
| `description` | text null | |
| `created_at` | timestamptz | |

### `project_members`
| Column | Type | Notes |
|---|---|---|
| `project_id` | uuid FK | |
| `user_id` | uuid FK | |
| `role` | enum `project_role` (`owner`,`editor`,`viewer`) | |
| composite PK | `(project_id, user_id)` | |

### `tasks`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | OpenFGA `task:<id>` |
| `project_id` | uuid FK → projects | parent; permissions derive from here |
| `title` | text not null | |
| `description` | text null | |
| `status` | enum `task_status` (`todo`,`in_progress`,`done`) default `todo` | Kanban column |
| `assignee_id` | uuid FK → users null | |
| `position` | int | ordering within a column |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | bump on every PATCH |

## SQLAlchemy model sketch

```python
# models/base.py
import uuid
from datetime import datetime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import func

class Base(DeclarativeBase):
    pass

def pk():
    return mapped_column(primary_key=True, default=uuid.uuid4)

# models/org.py
class Org(Base):
    __tablename__ = "orgs"
    id: Mapped[uuid.UUID] = pk()
    name: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

# models/project.py
class Project(Base):
    __tablename__ = "projects"
    id: Mapped[uuid.UUID] = pk()
    org_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orgs.id"))
    name: Mapped[str]
    description: Mapped[str | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

# models/task.py
class TaskStatus(str, enum.Enum):
    todo = "todo"; in_progress = "in_progress"; done = "done"

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[uuid.UUID] = pk()
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"))
    title: Mapped[str]
    description: Mapped[str | None]
    status: Mapped[TaskStatus] = mapped_column(default=TaskStatus.todo)
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    position: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(server_default=func.now(), onupdate=func.now())
```

Use the **async** engine (`postgresql+asyncpg://`) since FastAPI is async and OpenFGA calls are async too.

## Migrations (Alembic)

```bash
alembic init -t async alembic          # async template
# set sqlalchemy.url from env in env.py, import Base.metadata as target_metadata
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Migration order matters only by FK: `users`/`orgs` → `org_members`/`projects` → `project_members`/`tasks`. Autogenerate handles this if all models are imported before `target_metadata` is read.

> Note: enums in Postgres are created as real `TYPE`s. If you rename an enum value later you need a manual migration — autogenerate won't catch enum value changes. For this project the enums are stable, so don't worry about it.

## Tenant scoping rule

Every query that lists or fetches data **must** be scoped, even though OpenFGA gates access. Defense in depth:

- `GET /projects` → only projects in orgs the user belongs to (join `org_members`).
- `GET /tasks?project_id=` → filter by `project_id`, and authz-check `can_view` on the project.

OpenFGA tells you *yes/no for one object*. For **list** endpoints you either (a) list candidate rows from Postgres then batch-check, or (b) use OpenFGA's `ListObjects` API. See [03-AUTHORIZATION.md → Listing](./03-AUTHORIZATION.md#listing-what-can-i-see).
