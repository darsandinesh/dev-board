"""Task (issue) + comment, with Jira-like fields."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import ARRAY, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, pk


class TaskStatus(str, enum.Enum):
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskType(str, enum.Enum):
    epic = "epic"
    task = "task"
    story = "story"
    bug = "bug"


class LinkType(str, enum.Enum):
    blocks = "blocks"
    blocked_by = "blocked_by"
    relates_to = "relates_to"
    duplicates = "duplicates"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    urgent = "urgent"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[uuid.UUID] = pk()  # OpenFGA `task:<id>`
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    # Parent issue: a story's epic, or a sub-task's parent task.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="SET NULL"), index=True
    )
    seq: Mapped[int | None]  # per-project issue number (key display: PROJ-<seq>)
    title: Mapped[str]
    description: Mapped[str | None]
    status: Mapped[TaskStatus] = mapped_column(default=TaskStatus.todo)
    type: Mapped[TaskType] = mapped_column(default=TaskType.task, server_default="task")
    priority: Mapped[TaskPriority] = mapped_column(
        default=TaskPriority.medium, server_default="medium"
    )
    labels: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default="{}"
    )
    story_points: Mapped[int | None]
    due_date: Mapped[date | None]
    assignee_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )
    position: Mapped[int] = mapped_column(default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now()
    )


class TaskComment(Base):
    __tablename__ = "task_comments"

    id: Mapped[uuid.UUID] = pk()
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    body: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class TaskLink(Base):
    """Directed relationship between two issues (blocks / relates_to / …)."""

    __tablename__ = "task_links"

    id: Mapped[uuid.UUID] = pk()
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    target_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    link_type: Mapped[LinkType]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class TaskActivity(Base):
    """Append-only audit of changes to an issue (created, status, assignee, …)."""

    __tablename__ = "task_activity"

    id: Mapped[uuid.UUID] = pk()
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    actor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    action: Mapped[str]            # created | status | assignee | priority | type | edited
    detail: Mapped[str | None]     # human-readable, e.g. "todo → done"
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
