"""Attachment metadata schema (never returns the file bytes)."""

import uuid
from datetime import datetime

from pydantic import BaseModel


class AttachmentOut(BaseModel):
    id: uuid.UUID
    task_id: uuid.UUID
    filename: str
    content_type: str
    size: int
    created_at: datetime
