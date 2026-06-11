"""Org + OrgMember + org_role enum."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, pk


class OrgRole(str, enum.Enum):
    admin = "admin"
    member = "member"


class Org(Base):
    __tablename__ = "orgs"

    id: Mapped[uuid.UUID] = pk()  # also the OpenFGA `org:<id>` object id
    name: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class OrgMember(Base):
    """DB-side mirror of org membership. OpenFGA holds the authoritative tuples;
    this table powers the members-list UI."""

    __tablename__ = "org_members"

    org_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("orgs.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    role: Mapped[OrgRole]
