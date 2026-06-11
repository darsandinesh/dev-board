"""
Task endpoints.

Authz (Day 3): POST /tasks and GET /tasks?project_id check the parent *project*
(the task may not exist yet / the list is project-scoped), so they call authz
inline. GET/PATCH/DELETE on a single task use require() on the task itself —
OpenFGA does the task→project traversal internally (can_edit/can_view).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.core.authz import authz, require
from app.db.session import get_db
from app.models.project import Project
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, user: DBUser, db: Db):
    """Create a task in a project. (Auth: can_edit on the parent project.)"""
    if await db.get(Project, body.project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    # "can_edit on a project" = the project's `editor` relation (editor or owner).
    if not await authz.check(f"user:{user.keycloak_sub}", "editor", f"project:{body.project_id}"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")

    task = Task(
        project_id=body.project_id,
        title=body.title,
        description=body.description,
        status=body.status,
        assignee_id=body.assignee_id,
        position=body.position,
    )
    db.add(task)
    await db.flush()
    await authz.write(f"project:{body.project_id}", "project", f"task:{task.id}")
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(project_id: uuid.UUID, user: DBUser, db: Db):
    """List tasks in a project (Kanban feed). (Auth: viewer on the project.)"""
    if not await authz.check(f"user:{user.keycloak_sub}", "viewer", f"project:{project_id}"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")
    rows = await db.execute(
        select(Task).where(Task.project_id == project_id).order_by(Task.status, Task.position)
    )
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
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.flush()
    # `updated_at` is set by an ON UPDATE server default; reload so the response
    # serializer reads it without triggering a lazy load outside the async context.
    await db.refresh(task)
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
    await db.delete(task)
    await db.flush()
    await authz.delete(f"project:{project_id}", "project", f"task:{task_id}")
