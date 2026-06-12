"""
Issue attachments. Files are stored in Postgres (bytea) — fine for a
self-contained app with a size cap; at scale you'd push to object storage.
View to list/download; edit to upload/delete.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import DBUser
from app.core.authz import require
from app.db.session import get_db
from app.models.attachment import Attachment
from app.models.task import Task
from app.schemas.attachment import AttachmentOut

MAX_BYTES = 5 * 1024 * 1024  # 5 MB

router = APIRouter()

Db = Annotated[AsyncSession, Depends(get_db)]


@router.get(
    "/{task_id}/attachments",
    response_model=list[AttachmentOut],
    dependencies=[Depends(require("can_view", "task", "task_id"))],
)
async def list_attachments(task_id: uuid.UUID, user: DBUser, db: Db):
    rows = await db.execute(
        select(
            Attachment.id, Attachment.task_id, Attachment.filename,
            Attachment.content_type, Attachment.size, Attachment.created_at,
        ).where(Attachment.task_id == task_id).order_by(Attachment.created_at)
    )
    return [AttachmentOut(**r._mapping) for r in rows.all()]


@router.post(
    "/{task_id}/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require("can_edit", "task", "task_id"))],
)
async def upload_attachment(
    task_id: uuid.UUID, user: DBUser, db: Db, file: UploadFile = File(...)
):
    if await db.get(Task, task_id) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Task not found")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "File too large (max 5MB)")
    att = Attachment(
        task_id=task_id, uploader_id=user.id, filename=file.filename or "file",
        content_type=file.content_type or "application/octet-stream",
        size=len(data), data=data,
    )
    db.add(att)
    await db.flush()
    return AttachmentOut(
        id=att.id, task_id=task_id, filename=att.filename,
        content_type=att.content_type, size=att.size, created_at=att.created_at,
    )


@router.get(
    "/{task_id}/attachments/{att_id}/download",
    dependencies=[Depends(require("can_view", "task", "task_id"))],
)
async def download_attachment(task_id: uuid.UUID, att_id: uuid.UUID, user: DBUser, db: Db):
    att = await db.get(Attachment, att_id)
    if att is None or att.task_id != task_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    return Response(
        content=att.data,
        media_type=att.content_type,
        headers={"Content-Disposition": f'attachment; filename="{att.filename}"'},
    )


@router.delete(
    "/{task_id}/attachments/{att_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require("can_edit", "task", "task_id"))],
)
async def delete_attachment(task_id: uuid.UUID, att_id: uuid.UUID, user: DBUser, db: Db):
    att = await db.get(Attachment, att_id)
    if att is None or att.task_id != task_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    await db.delete(att)
