"""
Project endpoints — Day 2: JWT-gated CRUD only, NO authz checks yet.

Tenant scoping (defense in depth, doc 02): GET /projects only returns projects
in orgs the caller belongs to. Day 3 replaces this with OpenFGA viewer checks.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.db.session import get_db
from app.models.org import Org, OrgMember
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
    """Create a project inside an org; the creator becomes project owner."""
    if await db.get(Org, body.org_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Org not found")
    project = Project(org_id=body.org_id, name=body.name, description=body.description)
    db.add(project)
    await db.flush()  # populate project.id
    db.add(
        ProjectMember(project_id=project.id, user_id=user.id, role=ProjectRole.owner)
    )
    await db.flush()
    # TODO Day 3: write tuples (project,org,org:<org_id>) and (user,owner,project:<id>)
    return project


@router.get("", response_model=list[ProjectListItem])
async def list_projects(user: DBUser, db: Db):
    """List projects the caller can view (Day 2: projects in the caller's orgs)."""
    rows = await db.execute(
        select(Project, ProjectMember.role)
        .join(OrgMember, OrgMember.org_id == Project.org_id)
        .outerjoin(
            ProjectMember,
            (ProjectMember.project_id == Project.id)
            & (ProjectMember.user_id == user.id),
        )
        .where(OrgMember.user_id == user.id)
    )
    items: list[ProjectListItem] = []
    for project, role in rows.all():
        item = ProjectListItem.model_validate(project)
        item.my_role = role.value if role is not None else None
        items.append(item)
    return items


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: uuid.UUID, user: DBUser, db: Db):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project


@router.get("/{project_id}/members", response_model=list[MemberOut])
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

    db.add(
        ProjectMember(project_id=project_id, user_id=body.user_id, role=body.role)
    )
    await db.flush()
    # TODO Day 3: write tuple (user:<uid>, <role>, project:<id>)
    return MemberOut(
        user_id=body.user_id, username=target.username, role=body.role.value
    )


@router.patch("/{project_id}/members/{user_id}", response_model=MemberOut)
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
    member.role = body.role
    await db.flush()
    # TODO Day 3: delete old tuple, write new tuple, invalidate cache
    target = await db.get(User, user_id)
    return MemberOut(user_id=user_id, username=target.username, role=body.role.value)


@router.delete(
    "/{project_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def remove_project_member(
    project_id: uuid.UUID, user_id: uuid.UUID, user: DBUser, db: Db
):
    member = await db.get(ProjectMember, (project_id, user_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    await db.delete(member)
    # TODO Day 3: delete tuple, invalidate cache
