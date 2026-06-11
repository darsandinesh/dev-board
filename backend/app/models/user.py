"""User — local mirror of a Keycloak identity (created lazily on first auth)."""

import uuid
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, pk


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = pk()
    # The `sub` claim from the JWT — the stable join key to Keycloak identity.
    keycloak_sub: Mapped[str] = mapped_column(unique=True, index=True)
    email: Mapped[str]
    username: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
