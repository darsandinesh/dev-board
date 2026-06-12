"""
Task endpoints.

POST /tasks and GET /tasks?project_id check the parent *project* (the task may
not exist yet / the list is project-scoped). GET/PATCH/DELETE on a single task
use require() on the task itself — OpenFGA does the task→project traversal.

Visibility: editors+ (Developer/Admin/tenant/platform admin) see every task in a
project; a plain viewer sees ONLY the tasks assigned to them. Assignment is an
OpenFGA `assignee` tuple kept in sync with the task's assignee_id.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.core.authz import authz, require
from app.db.session import get_db
from app.models.project import Project
from app.models.task import Task, TaskActivity, TaskComment
from app.models.user import User
from app.schemas.task import (
    ActivityOut,
    CommentCreate,
    CommentOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


async def _sub_for(db: AsyncSession, user_id: uuid.UUID | None) -> str | None:
    if user_id is None:
        return None
    u = await db.get(User, user_id)
    return u.keycloak_sub if u else None


async def _log(db: AsyncSession, task_id, actor_id, action: str, detail: str | None = None):
    db.add(TaskActivity(task_id=task_id, actor_id=actor_id, action=action, detail=detail))


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, user: DBUser, db: Db):
    """Create a task in a project. (Auth: editor — Developer or above.)"""
    if await db.get(Project, body.project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    if not await authz.check(f"user:{user.keycloak_sub}", "editor", f"project:{body.project_id}"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")

    next_seq = (
        await db.execute(
            select(func.coalesce(func.max(Task.seq), 0)).where(
                Task.project_id == body.project_id
            )
        )
    ).scalar() + 1

    task = Task(
        project_id=body.project_id,
        seq=next_seq,
        title=body.title,
        description=body.description,
        status=body.status,
        type=body.type,
        priority=body.priority,
        labels=body.labels,
        story_points=body.story_points,
        due_date=body.due_date,
        assignee_id=body.assignee_id,
        position=body.position,
    )
    db.add(task)
    await db.flush()
    await _log(db, task.id, user.id, "created", task.title)
    await authz.write(f"project:{body.project_id}", "project", f"task:{task.id}")
    assignee_sub = await _sub_for(db, body.assignee_id)
    if assignee_sub:
        await authz.write(f"user:{assignee_sub}", "assignee", f"task:{task.id}")
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(project_id: uuid.UUID, user: DBUser, db: Db):
    """Kanban feed. Editors+ see all tasks; a viewer sees only their assigned tasks."""
    me = f"user:{user.keycloak_sub}"
    base = select(Task).where(Task.project_id == project_id).order_by(Task.status, Task.position)

    if await authz.check(me, "editor", f"project:{project_id}"):
        rows = await db.execute(base)
    elif await authz.check(me, "viewer", f"project:{project_id}"):
        # viewer: only tasks assigned to them
        rows = await db.execute(base.where(Task.assignee_id == user.id))
    else:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    return list(rows.scalars().all())


@router.get(
    "/{task_id}",
    response_model=TaskOut,
    dependencies=[Depends(require("can_view", "task", "task_id"))],
)
async def get_task(task_id: uuid.UUID, user: DBUser, db: Db):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.patch(
    "/{task_id}",
    response_model=TaskOut,
    dependencies=[Depends(require("can_edit", "task", "task_id"))],
)
async def update_task(task_id: uuid.UUID, body: TaskUpdate, user: DBUser, db: Db):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")

    patch = body.model_dump(exclude_unset=True)
    old_assignee_id = task.assignee_id
    # Capture old values for activity logging (status/priority/type changes).
    olds = {f: getattr(task, f) for f in ("status", "priority", "type")}
    for field, value in patch.items():
        setattr(task, field, value)
    await db.flush()
    await db.refresh(task)  # `updated_at` ON UPDATE default

    for field in ("status", "priority", "type"):
        if field in patch and patch[field] != olds[field]:
            ov = olds[field].value if hasattr(olds[field], "value") else olds[field]
            nv = patch[field].value if hasattr(patch[field], "value") else patch[field]
            await _log(db, task.id, user.id, field, f"{ov} → {nv}")
    if "assignee_id" in patch and patch["assignee_id"] != old_assignee_id:
        await _log(db, task.id, user.id, "assignee",
                   "unassigned" if patch["assignee_id"] is None else "reassigned")

    # Keep the assignee tuple in sync if assignee changed.
    if "assignee_id" in patch and patch["assignee_id"] != old_assignee_id:
        old_sub = await _sub_for(db, old_assignee_id)
        if old_sub:
            await authz.delete(f"user:{old_sub}", "assignee", f"task:{task_id}")
        new_sub = await _sub_for(db, patch["assignee_id"])
        if new_sub:
            await authz.write(f"user:{new_sub}", "assignee", f"task:{task_id}")
    return task


@router.delete(
    "/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require("can_edit", "task", "task_id"))],
)
async def delete_task(task_id: uuid.UUID, user: DBUser, db: Db):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    project_id = task.project_id
    assignee_sub = await _sub_for(db, task.assignee_id)
    await db.delete(task)
    await db.flush()
    await authz.delete(f"project:{project_id}", "project", f"task:{task_id}")
    if assignee_sub:
        await authz.delete(f"user:{assignee_sub}", "assignee", f"task:{task_id}")


# ---------------------------------------------------------------------------
# Comments — anyone who can_view the task may read & post.
# ---------------------------------------------------------------------------
@router.get(
    "/{task_id}/comments",
    response_model=list[CommentOut],
    dependencies=[Depends(require("can_view", "task", "task_id"))],
)
async def list_comments(task_id: uuid.UUID, user: DBUser, db: Db):
    rows = await db.execute(
        select(TaskComment, User.username)
        .join(User, User.id == TaskComment.author_id)
        .where(TaskComment.task_id == task_id)
        .order_by(TaskComment.created_at)
    )
    return [
        CommentOut(
            id=c.id, task_id=c.task_id, author_id=c.author_id,
            author_username=username, body=c.body, created_at=c.created_at,
        )
        for c, username in rows.all()
    ]


@router.post(
    "/{task_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require("can_view", "task", "task_id"))],
)
async def add_comment(task_id: uuid.UUID, body: CommentCreate, user: DBUser, db: Db):
    if await db.get(Task, task_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    comment = TaskComment(task_id=task_id, author_id=user.id, body=body.body)
    db.add(comment)
    await _log(db, task_id, user.id, "commented")
    await db.flush()
    await db.refresh(comment)
    return CommentOut(
        id=comment.id, task_id=task_id, author_id=user.id,
        author_username=user.username, body=comment.body, created_at=comment.created_at,
    )


@router.get(
    "/{task_id}/activity",
    response_model=list[ActivityOut],
    dependencies=[Depends(require("can_view", "task", "task_id"))],
)
async def list_activity(task_id: uuid.UUID, user: DBUser, db: Db):
    rows = await db.execute(
        select(TaskActivity, User.username)
        .join(User, User.id == TaskActivity.actor_id)
        .where(TaskActivity.task_id == task_id)
        .order_by(TaskActivity.created_at.desc())
    )
    return [
        ActivityOut(
            id=a.id, actor_username=username, action=a.action,
            detail=a.detail, created_at=a.created_at,
        )
        for a, username in rows.all()
    ]
