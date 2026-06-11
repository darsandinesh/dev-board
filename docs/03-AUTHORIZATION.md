# 03 — Authorization (OpenFGA) — the core of the project

This is the doc the whole week builds toward. Read it slowly.

## Mental model: ReBAC

OpenFGA implements **Relationship-Based Access Control** (the Google Zanzibar model). Instead of "user has role X" you store **relationship tuples**:

```
(user:alice, owner,  project:42)      "alice is owner of project 42"
(project:42, org,     org:acme)        "project 42 belongs to org acme"
(user:bob,   member,  org:acme)        "bob is a member of org acme"
```

A permission question — "can bob view task 99?" — becomes a **graph traversal**:

```
can_view(task:99)
  → viewer(project:7)            (task's can_view derives from project viewer)
      → editor(project:7)?        no
      → member from org?          project:7 → org:acme, bob member of acme? YES
  → allowed
```

You never write `bob can view task 99` directly. You write the *relationships*, and OpenFGA *computes* the permission. That's the superpower.

## The authorization model

`infra/openfga/model.fga` (DSL form):

```dsl
model
  schema 1.1

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

### Reading each line

| Line | Meaning |
|---|---|
| `define admin: [user]` | admins are explicitly assigned users |
| `define member: [user] or admin` | a member is an explicitly-assigned user **or** anyone who is admin (admins are implicitly members) |
| `define org: [org]` | a project points to its parent org via the `org` relation |
| `define owner: [user]` | project owners are explicitly assigned |
| `define editor: [user] or owner` | editors are explicit, plus all owners |
| `define viewer: [user] or editor or member from org` | viewers are explicit, plus all editors, **plus every member of the project's org** |
| `define can_edit: editor from project` | you can edit a task if you're an editor of its parent project |
| `define can_view: viewer from project` | you can view a task if you're a viewer of its parent project |

`X from Y` means: "follow my `Y` relation to another object, then check `X` there." `member from org` on a project = "the `member` relation on the org this project's `org` points to."

> Note: `member from org` granting `viewer` is a real design decision: **every org member can view every project in their org by default.** If you want private projects, remove `or member from org` and explicitly grant viewers. The brief keeps it open — fine for learning. Flag this in ARCHITECTURE's "things I'd do differently."

### Why this model is elegant

- Adding a user as project `owner` automatically gives them `editor` and `viewer` (the `or` chains) — and therefore `can_edit`/`can_view` on **every task** in that project, with zero per-task tuples.
- Moving a task between projects? Just rewrite its one `project` tuple. All permissions recompute.

## Tuple lifecycle — who writes what, when

| App action | Postgres write | OpenFGA tuple write |
|---|---|---|
| Create org (by user U) | insert `orgs`, `org_members(U, admin)` | `(user:U, admin, org:<id>)` |
| Add member M to org as `member` | insert `org_members(M, member)` | `(user:M, member, org:<id>)` |
| Create project P in org O (by admin) | insert `projects`, `project_members(U, owner)` | `(project:<id>, org, org:O)` **and** `(user:U, owner, project:<id>)` |
| Add user E to project as `editor` | insert `project_members(E, editor)` | `(user:E, editor, project:<id>)` |
| Change role viewer→editor | update `project_members.role` | **delete** old tuple, **write** new tuple |
| Create task T in project P | insert `tasks` | `(task:<id>, project, project:P)` |
| Delete project | delete rows | delete all tuples for that project + cascade tasks |

> Note: This is the trickiest correctness issue in the whole app — **keeping Postgres and OpenFGA in sync.** Wrap them so a failure in one doesn't silently leave the other stale. For a one-week build, write the OpenFGA tuple inside the same request handler right after the DB commit, and log loudly on failure. At real scale you'd use the outbox pattern (note this in Day 7 reflections).

## The check helper

`core/authz.py`:

```python
from openfga_sdk import OpenFgaClient, ClientConfiguration
from openfga_sdk.client.models import ClientCheckRequest, ClientTuple, ClientWriteRequest

class Authz:
    def __init__(self, api_url: str, store_id: str, model_id: str, redis):
        self._cfg = ClientConfiguration(api_url=api_url, store_id=store_id,
                                        authorization_model_id=model_id)
        self._redis = redis

    async def check(self, user: str, relation: str, obj: str) -> bool:
        key = f"authz:{user}:{relation}:{obj}"
        cached = await self._redis.get(key)
        if cached is not None:
            return cached == b"1"
        async with OpenFgaClient(self._cfg) as fga:
            resp = await fga.check(ClientCheckRequest(user=user, relation=relation, object=obj))
        allowed = bool(resp.allowed)
        await self._redis.set(key, b"1" if allowed else b"0", ex=30)   # 30s TTL
        return allowed

    async def write(self, user: str, relation: str, obj: str):
        async with OpenFgaClient(self._cfg) as fga:
            await fga.write(ClientWriteRequest(
                writes=[ClientTuple(user=user, relation=relation, object=obj)]))
        await self._invalidate(user)

    async def delete(self, user: str, relation: str, obj: str):
        async with OpenFgaClient(self._cfg) as fga:
            await fga.write(ClientWriteRequest(
                deletes=[ClientTuple(user=user, relation=relation, object=obj)]))
        await self._invalidate(user)

    async def _invalidate(self, user: str):
        # simplest correct option: drop all cached answers for this user
        async for k in self._redis.scan_iter(f"authz:{user}:*"):
            await self._redis.delete(k)
```

## The FastAPI dependency

This is the gate. It pulls the user from the validated JWT, resolves the object id from the path, and checks.

```python
# core/authz.py (continued)
from fastapi import Depends, HTTPException, Path

def require(relation: str, obj_type: str):
    async def _dep(
        obj_id: str = Path(..., alias="id"),
        user = Depends(current_user),          # from auth.py — the JWT subject
        authz: Authz = Depends(get_authz),
    ):
        allowed = await authz.check(
            user=f"user:{user.sub}",
            relation=relation,
            object=f"{obj_type}:{obj_id}",
        )
        if not allowed:
            raise HTTPException(status_code=403, detail="Forbidden")
    return _dep
```

Usage in a router:

```python
@router.patch("/tasks/{id}", dependencies=[Depends(require("can_edit", "task"))])
async def update_task(id: str, body: TaskUpdate, ...):
    ...
```

> Note: For a `PATCH /tasks/{id}` the object is the task itself and the relation is `can_edit` — OpenFGA does the project traversal internally because of `can_edit: editor from project`. You do **not** need to look up the project_id yourself. That's the model doing the work.

## Listing — "what can I see?"

`check()` answers one object at a time. For `GET /projects` you have two options:

1. **List-then-check (simple, fine for the week):** load candidate projects from Postgres (scoped to the user's orgs), then `check(can_view)` each. Cache makes the repeat checks cheap. Acceptable for small data.
2. **OpenFGA `ListObjects` (the "right" way):**
   ```python
   resp = await fga.list_objects(ClientListObjectsRequest(
       user=f"user:{user.sub}", relation="viewer", type="project"))
   # resp.objects = ["project:1", "project:7", ...] → strip prefix, query Postgres for those rows
   ```
   One call returns every object the user can view. Then fetch those rows from Postgres for display data.

Recommend starting with (1) on Day 3, switching to (2) if you have time — it's a great thing to understand.

## Caching & invalidation (Day 5)

- **Key:** `authz:{user}:{relation}:{object}` → `"1"`/`"0"`, TTL 30s.
- **Why short TTL:** bounds staleness if invalidation ever misses. 30s means a revoked permission is gone within 30s worst case.
- **Invalidate on write/delete tuple:** drop all `authz:{user}:*` keys for the affected user. Role changes affect derived permissions across many objects, so per-key invalidation is hard to get right — wipe the user's namespace instead.

> Note: A role change can affect **other** users too (e.g. making someone org admin changes nothing for others, but org structure changes can). For this project, invalidating only the directly-affected user is acceptable given the 30s TTL backstop. Note the limitation in Day 7.

## Bootstrapping the store (Day 1/3)

OpenFGA needs a **store** and a **model** before you can write tuples. Do this once at startup or via a script:

```bash
# create store
fga store create --name devboard
# write the model, capture the returned authorization_model_id
fga model write --store-id <STORE_ID> --file infra/openfga/model.fga
```

Persist `store_id` and `authorization_model_id` to env / `.env`. The check helper needs both. See [05-INFRASTRUCTURE.md](./05-INFRASTRUCTURE.md#openfga-bootstrap).

## Test cases that prove you understand it (Day 3 / Day 6)

| Setup | Check | Expect |
|---|---|---|
| alice = org admin, no project tuples | `can_view` on a project in that org | **true** (member-from-org) |
| bob = explicit project viewer | `can_edit` on a task in it | **false** |
| bob = explicit project editor | `can_edit` on a task in it | **true** |
| carol = nothing | any check | **false** → 403 |
| dave = owner, then deleted his editor... | owner still implies editor | **true** (owner ⇒ editor) |

If the row "org admin can view a project with no project tuple" returns true and you can explain *why* (the `member from org` traversal), you've got it.
