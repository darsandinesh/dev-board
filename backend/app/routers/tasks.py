"""
Task endpoints — Day 2: JWT-gated CRUD only, NO authz checks yet.

Day 3 adds can_edit/can_view checks and the task→project tuple writes.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.db.session import get_db
from app.models.project import Project
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskOut, TaskUpdate

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
async def create_task(body: TaskCreate, user: DBUser, db: Db):
    if await db.get(Project, body.project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
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
    # TODO Day 3: write tuple (task:<id>, project, project:<project_id>)
    return task


@router.get("", response_model=list[TaskOut])
async def list_tasks(project_id: uuid.UUID, user: DBUser, db: Db):
    """List tasks in a project (the Kanban board feed). `project_id` is required."""
    rows = await db.execute(
        select(Task)
        .where(Task.project_id == project_id)
        .order_by(Task.status, Task.position)
    )
    return list(rows.scalars().all())


@router.get("/{task_id}", response_model=TaskOut)
async def get_task(task_id: uuid.UUID, user: DBUser, db: Db):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskOut)
async def update_task(task_id: uuid.UUID, body: TaskUpdate, user: DBUser, db: Db):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    await db.flush()  # updated_at bumps via onupdate
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(task_id: uuid.UUID, user: DBUser, db: Db):
    task = await db.get(Task, task_id)
    if task is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    await db.delete(task)
    # TODO Day 3: delete the project tuple for the task
