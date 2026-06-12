"""Sprint — a time-boxed set of issues within a project."""

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, pk


class SprintState(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"


class Sprint(Base):
    __tablename__ = "sprints"

    id: Mapped[uuid.UUID] = pk()
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str]
    goal: Mapped[str | None]
    state: Mapped[SprintState] = mapped_column(
        default=SprintState.planned, server_default="planned"
    )
    start_date: Mapped[date | None]
    end_date: Mapped[date | None]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
