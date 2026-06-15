"""In-app notifications (assignment, @mentions, comments)."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, pk


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = pk()
    user_id: Mapped[uuid.UUID] = mapped_column(  # recipient
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    task_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"))
    kind: Mapped[str]  # assigned | mentioned | commented
    message: Mapped[str]
    is_read: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
