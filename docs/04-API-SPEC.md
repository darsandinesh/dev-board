# 04 — API Specification

Base URL (local): `http://localhost:8000`
All endpoints require `Authorization: Bearer <JWT>` unless noted. Auth rules reference relations from [03-AUTHORIZATION.md](./03-AUTHORIZATION.md).

## Conventions

- Bodies and responses are JSON.
- IDs are UUID strings.
- Timestamps are ISO-8601 UTC.
- Standard errors: `401` (no/invalid token), `403` (valid token, not allowed), `404` (not found / not visible), `422` (validation).
- `404` vs `403` **(decision):** returning `404` instead of `403` for objects the user can't see avoids leaking existence. Recommend: `403` for write actions on visible objects, `404` when the object isn't visible at all. For the week, plain `403` everywhere is acceptable — just be consistent.

---

## Identity

### `GET /me`
Returns the decoded identity from the JWT. Day 1 deliverable.

**Auth:** valid token only.
**200:**
```json
{ "sub": "a1b2...", "email": "alice@example.com", "username": "alice" }
```

---

## Orgs

### `POST /orgs`
Create an org. The creator becomes org `admin`.

**Auth:** any authenticated user.
**Body:** `{ "name": "Acme" }`
**Side effects:** insert org + `org_members(creator, admin)`; write tuple `(user:<creator>, admin, org:<id>)`.
**201:** `{ "id": "...", "name": "Acme", "created_at": "..." }`

### `GET /orgs/{id}`
**Auth:** `member` of the org (`member` relation; admins included).
**200:** org object. **403/404** otherwise.

### `GET /orgs/{id}/members`
**Auth:** `member` of org.
**200:** `[{ "user_id": "...", "username": "bob", "role": "member" }, ...]`

### `POST /orgs/{id}/members`
Add a user to the org.

**Auth:** org `admin`.
**Body:** `{ "user_id": "...", "role": "member" }` (`admin`|`member`)
**Side effects:** insert `org_members`; write tuple `(user:<uid>, <role>, org:<id>)`.
**201:** member object.

### `PATCH /orgs/{id}/members/{user_id}`
Change a member's role.

**Auth:** org `admin`.
**Body:** `{ "role": "admin" }`
**Side effects:** update row; delete old tuple, write new tuple; invalidate cache for that user.
**200:** member object.

### `DELETE /orgs/{id}/members/{user_id}`
**Auth:** org `admin`.
**Side effects:** delete row + tuple; invalidate cache.
**204.**

---

## Projects

### `POST /projects`
Create a project inside an org. Creator becomes project `owner`.

**Auth:** org `admin` (admin of `body.org_id`).
**Body:** `{ "org_id": "...", "name": "Website", "description": "..." }`
**Side effects:** insert project + `project_members(creator, owner)`; write tuples `(project:<id>, org, org:<org_id>)` and `(user:<creator>, owner, project:<id>)`.
**201:** project object.

### `GET /projects`
List projects the caller can view.

**Auth:** authenticated. Returns only projects where caller has `viewer` (incl. via org membership).
**Impl:** OpenFGA `ListObjects(viewer, project)` → fetch rows; or list-then-check. See [03 → Listing](./03-AUTHORIZATION.md#listing-what-can-i-see).
**200:** `[{ "id": "...", "name": "...", "org_id": "...", "my_role": "editor" }, ...]`

> Note: `my_role` is a convenience field for the UI to decide which buttons to show. Compute it from `project_members` for the caller, or omit and let the frontend call check endpoints.

### `GET /projects/{id}`
**Auth:** project `viewer` (relation `can`... use `viewer`).
**200:** project object.

### `GET /projects/{id}/members`
**Auth:** project `viewer`.
**200:** `[{ "user_id": "...", "username": "...", "role": "editor" }, ...]`

### `POST /projects/{id}/members`
**Auth:** project `owner` (only owners manage membership) — **(decision)**; or allow `editor`. Recommend `owner`.
**Body:** `{ "user_id": "...", "role": "editor" }` (`owner`|`editor`|`viewer`)
**Side effects:** insert row; write tuple `(user:<uid>, <role>, project:<id>)`.
**201:** member object.

### `PATCH /projects/{id}/members/{user_id}` / `DELETE ...`
**Auth:** project `owner`. Role change: delete+write tuple, invalidate cache. Same shape as org member endpoints.

---

## Tasks

### `POST /tasks`
Create a task in a project.

**Auth:** `can_edit` on the **project** (editor or above). Note: object is the project here, not a task (the task doesn't exist yet).
**Body:** `{ "project_id": "...", "title": "...", "description": "...", "status": "todo", "assignee_id": null }`
**Side effects:** insert task; write tuple `(task:<id>, project, project:<project_id>)`.
**201:** task object.

### `GET /tasks/{id}`
**Auth:** `can_view` on the task.
**200:** task object.

### `GET /tasks?project_id={pid}`
List tasks in a project (the Kanban board feed).

**Auth:** `can_view` on the **project** (`viewer`). Then return all its tasks.
**200:** `[{ "id": "...", "title": "...", "status": "in_progress", "assignee_id": "...", "position": 2 }, ...]`

### `PATCH /tasks/{id}`
Edit a task (title, description, status, assignee, position). Used for Kanban drag (status + position).

**Auth:** `can_edit` on the task.
**Body (all optional):** `{ "title": "...", "status": "done", "position": 0, "assignee_id": "..." }`
**Side effects:** update row, bump `updated_at`. No tuple changes.
**200:** task object.

### `DELETE /tasks/{id}`
**Auth:** `can_edit` on the task.
**Side effects:** delete row; delete the `project` tuple for the task.
**204.**

---

## Authz introspection (optional, helps the frontend)

### `GET /me/permissions?object=project:42`
Returns the caller's effective relations on an object so the UI can render correctly without guessing.

**200:** `{ "can_view": true, "can_edit": false, "is_owner": false }`
Implemented as a few `check()` calls (cached). Lets the frontend hide edit buttons cleanly (Day 4).

---

## Endpoint → authz quick reference

| Method | Path | Required relation | On object |
|---|---|---|---|
| GET | /me | (auth only) | — |
| POST | /orgs | (auth only) | — |
| GET | /orgs/{id} | member | org:{id} |
| POST | /orgs/{id}/members | admin | org:{id} |
| POST | /projects | admin | org:{body.org_id} |
| GET | /projects | viewer (list) | project:* |
| GET | /projects/{id} | viewer | project:{id} |
| POST | /projects/{id}/members | owner | project:{id} |
| POST | /tasks | can_edit (editor) | project:{body.project_id} |
| GET | /tasks/{id} | can_view | task:{id} |
| GET | /tasks?project_id | viewer | project:{project_id} |
| PATCH | /tasks/{id} | can_edit | task:{id} |
| DELETE | /tasks/{id} | can_edit | task:{id} |

Pin this table next to your keyboard during Day 3.
