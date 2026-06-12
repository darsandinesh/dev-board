"""
Sprint endpoints. Sprints are project-scoped; sprint isn't an OpenFGA type, so
authz checks the parent project inline (viewer to read, editor to mutate).
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.core.authz import authz
from app.db.session import get_db
from app.models.project import Project
from app.models.sprint import Sprint
from app.schemas.sprint import SprintCreate, SprintOut, SprintUpdate

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


async def _require(user: DBUser, project_id: uuid.UUID, relation: str):
    if not await authz.check(f"user:{user.keycloak_sub}", relation, f"project:{project_id}"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")


@router.get("", response_model=list[SprintOut])
async def list_sprints(project_id: uuid.UUID, user: DBUser, db: Db):
    await _require(user, project_id, "viewer")
    rows = await db.execute(
        select(Sprint).where(Sprint.project_id == project_id).order_by(Sprint.created_at)
    )
    return list(rows.scalars().all())


@router.post("", response_model=SprintOut, status_code=status.HTTP_201_CREATED)
async def create_sprint(body: SprintCreate, user: DBUser, db: Db):
    if await db.get(Project, body.project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    await _require(user, body.project_id, "editor")
    sprint = Sprint(
        project_id=body.project_id, name=body.name, goal=body.goal,
        start_date=body.start_date, end_date=body.end_date,
    )
    db.add(sprint)
    await db.flush()
    return sprint


@router.patch("/{sprint_id}", response_model=SprintOut)
async def update_sprint(sprint_id: uuid.UUID, body: SprintUpdate, user: DBUser, db: Db):
    sprint = await db.get(Sprint, sprint_id)
    if sprint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
    await _require(user, sprint.project_id, "editor")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(sprint, field, value)
    await db.flush()
    return sprint


@router.delete("/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_sprint(sprint_id: uuid.UUID, user: DBUser, db: Db):
    sprint = await db.get(Sprint, sprint_id)
    if sprint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sprint not found")
    await _require(user, sprint.project_id, "editor")
    await db.delete(sprint)
