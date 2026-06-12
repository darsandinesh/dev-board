"""Sprint request/response schemas."""

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field

from app.models.sprint import SprintState


class SprintCreate(BaseModel):
    project_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    goal: str | None = None
    start_date: date | None = None
    end_date: date | None = None


class SprintUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    goal: str | None = None
    state: SprintState | None = None
    start_date: date | None = None
    end_date: date | None = None


class SprintOut(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    goal: str | None
    state: SprintState
    start_date: date | None
    end_date: date | None
    created_at: datetime

    model_config = {"from_attributes": True}
