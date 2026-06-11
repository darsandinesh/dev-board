"""
Org endpoints — Day 2: JWT-gated CRUD only, NO authz checks yet.

OpenFGA tuple writes + `require(...)` permission checks are added in Day 3.
For now any authenticated user can call these; the DB rows are the deliverable.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.db.session import get_db
from app.models.org import Org, OrgMember, OrgRole
from app.models.user import User
from app.schemas.common import MemberOut
from app.schemas.org import OrgCreate, OrgMemberCreate, OrgMemberRoleUpdate, OrgOut

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


@router.post("", response_model=OrgOut, status_code=status.HTTP_201_CREATED)
async def create_org(body: OrgCreate, user: DBUser, db: Db):
    """Create an org; the creator becomes org admin."""
    org = Org(name=body.name)
    db.add(org)
    await db.flush()  # populate org.id
    db.add(OrgMember(org_id=org.id, user_id=user.id, role=OrgRole.admin))
    await db.flush()
    # TODO Day 3: authz.write(f"user:{user.keycloak_sub}", "admin", "org", org.id)
    return org


@router.get("/{org_id}", response_model=OrgOut)
async def get_org(org_id: uuid.UUID, user: DBUser, db: Db):
    org = await db.get(Org, org_id)
    if org is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Org not found")
    return org


@router.get("/{org_id}/members", response_model=list[MemberOut])
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
    "/{org_id}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED
)
async def add_org_member(
    org_id: uuid.UUID, body: OrgMemberCreate, user: DBUser, db: Db
):
    if await db.get(Org, org_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Org not found")
    target = await db.get(User, body.user_id)
    if target is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    if await db.get(OrgMember, (org_id, body.user_id)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Already a member")

    db.add(OrgMember(org_id=org_id, user_id=body.user_id, role=body.role))
    await db.flush()
    # TODO Day 3: authz.write(f"user:{target.keycloak_sub}", body.role, "org", org_id)
    return MemberOut(user_id=body.user_id, username=target.username, role=body.role.value)


@router.patch("/{org_id}/members/{user_id}", response_model=MemberOut)
async def update_org_member_role(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    body: OrgMemberRoleUpdate,
    user: DBUser,
    db: Db,
):
    member = await db.get(OrgMember, (org_id, user_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    member.role = body.role
    await db.flush()
    # TODO Day 3: delete old tuple, write new tuple, invalidate cache
    target = await db.get(User, user_id)
    return MemberOut(user_id=user_id, username=target.username, role=body.role.value)


@router.delete("/{org_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_org_member(
    org_id: uuid.UUID, user_id: uuid.UUID, user: DBUser, db: Db
):
    member = await db.get(OrgMember, (org_id, user_id))
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Member not found")
    await db.delete(member)
    # TODO Day 3: delete tuple, invalidate cache
