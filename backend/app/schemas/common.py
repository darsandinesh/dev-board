"""Shared response schemas."""

import uuid

from pydantic import BaseModel


class MemberOut(BaseModel):
    """A row in an org/project members list."""

    user_id: uuid.UUID
    username: str
    role: str

    model_config = {"from_attributes": True}
