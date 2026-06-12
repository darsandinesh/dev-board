"""Project request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.project import ProjectRole


class ProjectCreate(BaseModel):
    org_id: uuid.UUID
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None


class ProjectOut(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    name: str
    description: str | None
    key: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectListItem(ProjectOut):
    # Convenience field for the UI to decide which buttons to show (doc 04).
    my_role: str | None = None


class ProjectMemberCreate(BaseModel):
    user_id: uuid.UUID
    role: ProjectRole = ProjectRole.viewer


class ProjectMemberRoleUpdate(BaseModel):
    role: ProjectRole
