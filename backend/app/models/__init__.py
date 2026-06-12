"""Import all models here so `Base.metadata` is fully populated for Alembic."""

from app.db.base import Base
from app.models.org import Org, OrgMember, OrgRole
from app.models.project import Project, ProjectMember, ProjectRole
from app.models.task import Task, TaskComment, TaskPriority, TaskStatus, TaskType
from app.models.user import User

__all__ = [
    "Base",
    "User",
    "Org",
    "OrgMember",
    "OrgRole",
    "Project",
    "ProjectMember",
    "ProjectRole",
    "Task",
    "TaskComment",
    "TaskStatus",
    "TaskType",
    "TaskPriority",
]
