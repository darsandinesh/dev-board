"""
Org endpoints.

Authz (Day 3): each endpoint is gated by an OpenFGA relation per doc 04, and
mutations dual-write the relationship tuples per doc 03's tuple lifecycle.

Tuple/DB consistency: we flush() to get ids and write the OpenFGA tuple inside
the handler; the request-scoped DB commit happens on success at request end. If
the tuple write raises, the exception rolls the DB transaction back, so neither
side persists. (Outbox pattern would be the at-scale answer — Day 7.)
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.core.authz import PLATFORM_OBJECT, authz, require, require_platform_admin
from app.db.session import get_db
from app.models.org import Org, OrgMember, OrgRole
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.user import User
from app.schemas.common import MemberOut
from app.schemas.org import (
    OrgCreate,
    OrgListItem,
    OrgMemberCreate,
    OrgMemberRoleUpdate,
    OrgOut,
)

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post(
    "",
    response_model=OrgOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_platform_admin)],
)
async def create_org(body: OrgCreate, user: DBUser, db: Db):
    """
    Create a tenant (org). Platform-admin only. The creator becomes the first
    tenant-admin. Also seeds a default project ("General") owned by the creator —
    org members get auto-added to it so they have somewhere to work immediately
    (projects are private otherwise).
    """
    org = Org(name=body.name)
    db.add(org)
    await db.flush()
    db.add(OrgMember(org_id=org.id, user_id=user.id, role=OrgRole.admin))

    default_project = Project(
        org_id=org.id, name="General", description="Default project", is_default=True
    )
    db.add(default_project)
    await db.flush()
    db.add(
        ProjectMember(
            project_id=default_project.id, user_id=user.id, role=ProjectRole.owner
        )
    )
    await db.flush()

    # Link the org under the platform (so platform-admins cascade into it),
    # make the creator tenant-admin, and own the default project.
    await authz.write(PLATFORM_OBJECT, "platform", f"org:{org.id}")
    await authz.write(f"user:{user.keycloak_sub}", "admin", f"org:{org.id}")
    await authz.write(f"org:{org.id}", "org", f"project:{default_project.id}")
    await authz.write(f"user:{user.keycloak_sub}", "owner", f"project:{default_project.id}")
    return org


@router.get("", response_model=list[OrgListItem])
async def list_my_orgs(user: DBUser, db: Db):
    """Orgs the caller belongs to (scoped via org_members), with their role."""
    rows = await db.execute(
        select(Org, OrgMember.role)
        .join(OrgMember, OrgMember.org_id == Org.id)
        .where(OrgMember.user_id == user.id)
    )
    return [
        OrgListItem(
            id=org.id, name=org.name, created_at=org.created_at, my_role=role.value
        )
        for org, role in rows.all()
    ]


@router.get(
    "/{org_id}",
    response_model=OrgOut,
    dependencies=[Depends(require("member", "org", "org_id"))],
)
async def get_org(org_id: uuid.UUID, user: DBUser, db: Db):
    org = await db.get(Org, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Org not found")
    return org


@router.get(
    "/{org_id}/members",
    response_model=list[MemberOut],
    dependencies=[Depends(require("member", "org", "org_id"))],
)
async def list_org_members(org_id: uuid.UUID, user: DBUser, db: Db):
    rows = await db.execute(
        select(OrgMember.user_id, User.username, OrgMember.role)
        .join(User, User.id == OrgMember.user_id)
        .where(OrgMember.org_id == org_id)
    )
    return [
        MemberOut(user_id=r.user_id, username=r.username, role=r.role.value)
        for r in rows.all()
    ]


@router.post(
    "/{org_id}/members",
    response_model=MemberOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require("admin", "org", "org_id"))],
)
async def add_org_member(org_id: uuid.UUID, body: OrgMemberCreate, user: DBUser, db: Db):
    if await db.get(Org, org_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Org not found")
    target = await db.get(User, body.user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if await db.get(OrgMember, (org_id, body.user_id)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already a member")

    db.add(OrgMember(org_id=org_id, user_id=body.user_id, role=body.role))
    await db.flush()
    await authz.write(f"user:{target.keycloak_sub}", body.role.value, f"org:{org_id}")

    # Auto-add to the org's default project as editor, so the new member can
    # work immediately (projects are private — org membership alone grants nothing).
    default_project = (
        await db.execute(
            select(Project).where(Project.org_id == org_id, Project.is_default.is_(True))
        )
    ).scalar_one_or_none()
    if default_project is not None and (
        await db.get(ProjectMember, (default_project.id, body.user_id)) is None
    ):
        db.add(
            ProjectMember(
                project_id=default_project.id,
                user_id=body.user_id,
                role=ProjectRole.editor,
            )
        )
        await db.flush()
        await authz.write(
            f"user:{target.keycloak_sub}", "editor", f"project:{default_project.id}"
        )

    return MemberOut(user_id=body.user_id, username=target.username, role=body.role.value)


@router.patch(
    "/{org_id}/members/{user_id}",
    response_model=MemberOut,
    dependencies=[Depends(require("admin", "org", "org_id"))],
)
async def update_org_member_role(
    org_id: uuid.UUID, user_id: uuid.UUID, body: OrgMemberRoleUpdate, user: DBUser, db: Db
):
    member = await db.get(OrgMember, (org_id, user_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    target = await db.get(User, user_id)
    old_role = member.role
    member.role = body.role
    await db.flush()
    if old_role != body.role:
        await authz.delete(f"user:{target.keycloak_sub}", old_role.value, f"org:{org_id}")
        await authz.write(f"user:{target.keycloak_sub}", body.role.value, f"org:{org_id}")
    return MemberOut(user_id=user_id, username=target.username, role=body.role.value)


@router.delete(
    "/{org_id}/members/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require("admin", "org", "org_id"))],
)
async def remove_org_member(org_id: uuid.UUID, user_id: uuid.UUID, user: DBUser, db: Db):
    member = await db.get(OrgMember, (org_id, user_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    target = await db.get(User, user_id)
    role = member.role
    await db.delete(member)
    await db.flush()
    await authz.delete(f"user:{target.keycloak_sub}", role.value, f"org:{org_id}")
