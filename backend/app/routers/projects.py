"""
Project endpoints.

Authz (Day 3): gated by OpenFGA relations per doc 04. POST /projects and
GET /projects check objects derived from the body/listing rather than a path
param, so they call authz inline instead of using the require() dependency.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.core.authz import authz, require
from app.db.session import get_db
from app.models.org import Org
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.user import User
from app.schemas.common import MemberOut
from app.schemas.project import (
    ProjectCreate,
    ProjectListItem,
    ProjectMemberCreate,
    ProjectMemberRoleUpdate,
    ProjectOut,
)

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(body: ProjectCreate, user: DBUser, db: Db):
    """Create a project inside an org; creator becomes owner. (Auth: org admin.)"""
    if await db.get(Org, body.org_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Org not found")
    if not await authz.check(f"user:{user.keycloak_sub}", "admin", f"org:{body.org_id}"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")

    project = Project(org_id=body.org_id, name=body.name, description=body.description)
    db.add(project)
    await db.flush()
    db.add(ProjectMember(project_id=project.id, user_id=user.id, role=ProjectRole.owner))
    await db.flush()
    # project belongs to org, and creator owns the project
    await authz.write(f"org:{body.org_id}", "org", f"project:{project.id}")
    await authz.write(f"user:{user.keycloak_sub}", "owner", f"project:{project.id}")
    return project


@router.get("", response_model=list[ProjectListItem])
async def list_projects(user: DBUser, db: Db):
    """List projects the caller can view, via OpenFGA ListObjects(viewer, project)."""
    visible_ids = await authz.list_objects(f"user:{user.keycloak_sub}", "viewer", "project")
    if not visible_ids:
        return []
    ids = [uuid.UUID(i) for i in visible_ids]
    rows = await db.execute(
        select(Project, ProjectMember.role)
        .outerjoin(
            ProjectMember,
            (ProjectMember.project_id == Project.id) & (ProjectMember.user_id == user.id),
        )
        .where(Project.id.in_(ids))
    )
    items: list[ProjectListItem] = []
    for project, role in rows.all():
        item = ProjectListItem.model_validate(project)
        item.my_role = role.value if role is not None else None
        items.append(item)
    return items


@router.get(
    "/{project_id}",
    response_model=ProjectOut,
    dependencies=[Depends(require("viewer", "project", "project_id"))],
)
async def get_project(project_id: uuid.UUID, user: DBUser, db: Db):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.get(
    "/{project_id}/members",
    response_model=list[MemberOut],
    dependencies=[Depends(require("viewer", "project", "project_id"))],
)
async def list_project_members(project_id: uuid.UUID, user: DBUser, db: Db):
    rows = await db.execute(
        select(ProjectMember.user_id, User.username, ProjectMember.role)
        .join(User, User.id == ProjectMember.user_id)
        .where(ProjectMember.project_id == project_id)
    )
    return [
        MemberOut(user_id=r.user_id, username=r.username, role=r.role.value)
        for r in rows.all()
    ]


@router.post(
    "/{project_id}/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require("owner", "project", "project_id"))],
)
async def add_project_member(
    project_id: uuid.UUID, body: ProjectMemberCreate, user: DBUser, db: Db
):
    if await db.get(Project, project_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    target = await db.get(User, body.user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if await db.get(ProjectMember, (project_id, body.user_id)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already a member")

    db.add(ProjectMember(project_id=project_id, user_id=body.user_id, role=body.role))
    await db.flush()
    await authz.write(f"user:{target.keycloak_sub}", body.role.value, f"project:{project_id}")
    return MemberOut(user_id=body.user_id, username=target.username, role=body.role.value)


@router.patch(
    "/{project_id}/members/{user_id}",
    response_model=MemberOut,
    dependencies=[Depends(require("owner", "project", "project_id"))],
)
async def update_project_member_role(
    project_id: uuid.UUID,
    user_id: uuid.UUID,
    body: ProjectMemberRoleUpdate,
    user: DBUser,
    db: Db,
):
    member = await db.get(ProjectMember, (project_id, user_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    target = await db.get(User, user_id)
    old_role = member.role
    member.role = body.role
    await db.flush()
    if old_role != body.role:
        await authz.delete(f"user:{target.keycloak_sub}", old_role.value, f"project:{project_id}")
        await authz.write(f"user:{target.keycloak_sub}", body.role.value, f"project:{project_id}")
    return MemberOut(user_id=user_id, username=target.username, role=body.role.value)


@router.delete(
    "/{project_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require("owner", "project", "project_id"))],
)
async def remove_project_member(
    project_id: uuid.UUID, user_id: uuid.UUID, user: DBUser, db: Db
):
    member = await db.get(ProjectMember, (project_id, user_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    target = await db.get(User, user_id)
    role = member.role
    await db.delete(member)
    await db.flush()
    await authz.delete(f"user:{target.keycloak_sub}", role.value, f"project:{project_id}")
