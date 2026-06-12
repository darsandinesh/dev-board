"""Notification response schema."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: uuid.UUID
    kind: str
    message: str
    task_id: uuid.UUID | None
    project_id: uuid.UUID | None
    actor_username: str | None
    is_read: bool
    created_at: datetime
