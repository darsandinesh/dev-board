"""
User lookup — supports member onboarding (search existing realm users by name
or email so admins can add them by something human, not a UUID).

Only users who have signed in at least once exist here (lazy provisioning), so
this is a directory of known users, not the full Keycloak realm.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import UserOut

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[UserOut])
async def search_users(
    user: DBUser,
    db: Db,
    search: str = Query("", description="Match against username or email"),
    limit: int = Query(10, ge=1, le=50),
):
    """List/search known users (authenticated). Empty search returns the first N."""
    stmt = select(User).order_by(User.username).limit(limit)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(or_(User.username.ilike(like), User.email.ilike(like)))
    rows = await db.execute(stmt)
    return list(rows.scalars().all())
