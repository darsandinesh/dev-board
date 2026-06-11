"""Org request/response schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.org import OrgRole


class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class OrgOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OrgMemberCreate(BaseModel):
    user_id: uuid.UUID
    role: OrgRole = OrgRole.member


class OrgMemberRoleUpdate(BaseModel):
    role: OrgRole
