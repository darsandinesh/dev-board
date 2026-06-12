"""Import all models here so `Base.metadata` is fully populated for Alembic."""

from app.db.base import Base
from app.models.attachment import Attachment
from app.models.notification import Notification
from app.models.org import Org, OrgMember, OrgRole
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.sprint import Sprint, SprintState
from app.models.task import (
    LinkType,
    Task,
    TaskActivity,
    TaskComment,
    TaskLink,
    TaskPriority,
    TaskStatus,
    TaskType,
)
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "Attachment",
    "Notification",
    "Org",
    "OrgMember",
    "OrgRole",
    "Project",
    "ProjectMember",
    "ProjectRole",
    "Sprint",
    "SprintState",
    "Task",
    "TaskComment",
    "TaskActivity",
    "TaskLink",
    "LinkType",
    "TaskStatus",
    "TaskType",
    "TaskPriority",
]
