"""The caller's in-app notifications (assignment, @mentions, comments)."""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.auth import DBUser
from app.db.session import get_db
from app.models.notification import Notification
from app.models.task import Task
from app.models.user import User
from app.schemas.notification import NotificationOut

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[NotificationOut])
async def my_notifications(user: DBUser, db: Db, limit: int = 50):
    actor = aliased(User)
    rows = await db.execute(
        select(Notification, actor.username, Task.project_id)
        .outerjoin(actor, actor.id == Notification.actor_id)
        .outerjoin(Task, Task.id == Notification.task_id)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    return [
        NotificationOut(
            id=n.id, kind=n.kind, message=n.message, task_id=n.task_id,
            project_id=project_id, actor_username=username,
            is_read=n.is_read, created_at=n.created_at,
        )
        for n, username, project_id in rows.all()
    ]


@router.post("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(notification_id: uuid.UUID, user: DBUser, db: Db):
    n = await db.get(Notification, notification_id)
    if n is None or n.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not found")
    n.is_read = True


@router.post("/read-all", status_code=status.HTTP_204_NO_CONTENT)
async def mark_all_read(user: DBUser, db: Db):
    await db.execute(
        update(Notification).where(Notification.user_id == user.id).values(is_read=True)
    )
