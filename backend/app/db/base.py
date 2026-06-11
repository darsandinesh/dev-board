"""
Declarative base + shared column helpers.

Kept separate from session.py so models can import `Base` without pulling in
the engine, and so Alembic can import `Base.metadata` cleanly.
"""

import uuid

from sqlalchemy.orm import DeclarativeBase, mapped_column


class Base(DeclarativeBase):
    pass


def pk():
    """UUID primary key, generated app-side (also used as the OpenFGA object id)."""
    return mapped_column(primary_key=True, default=uuid.uuid4)
