"""File attachments on issues (stored in-DB as bytea for a self-contained app)."""

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, LargeBinary, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, pk


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[uuid.UUID] = pk()
    task_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), index=True
    )
    uploader_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    filename: Mapped[str]
    content_type: Mapped[str]
    size: Mapped[int]
    data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
