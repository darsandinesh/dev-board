"""Task (issue) + comment request/response schemas."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.task import TaskPriority, TaskStatus, TaskType


class TaskCreate(BaseModel):
    project_id: uuid.UUID
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    status: TaskStatus = TaskStatus.todo
    type: TaskType = TaskType.task
    priority: TaskPriority = TaskPriority.medium
    labels: list[str] = Field(default_factory=list)
    story_points: int | None = Field(default=None, ge=0, le=100)
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None
    position: int = 0


class TaskUpdate(BaseModel):
    """All fields optional — Kanban drag (status/position) and full edits."""

    title: str | None = Field(default=None, min_length=1, max_length=500)
    description: str | None = None
    status: TaskStatus | None = None
    type: TaskType | None = None
    priority: TaskPriority | None = None
    labels: list[str] | None = None
    story_points: int | None = Field(default=None, ge=0, le=100)
    due_date: date | None = None
    assignee_id: uuid.UUID | None = None
    position: int | None = None


class TaskOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    title: str
    description: str | None
    status: TaskStatus
    type: TaskType
    priority: TaskPriority
    labels: list[str]
    story_points: int | None
    due_date: date | None
    assignee_id: uuid.UUID | None
    position: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=5000)


class CommentOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    author_id: uuid.UUID
    author_username: str
    body: str
    created_at: datetime
