"""
Rebuild the OpenFGA authorization graph from the Postgres source of truth.

Use when the two have drifted (e.g. tuples were wiped but DB rows remain). Writes
every org/project/task membership tuple derived from the DB; existing tuples are
skipped. Run from the backend venv:  python scripts/reconcile_openfga.py
"""

import asyncio

from sqlalchemy import select

from app.core.authz import PLATFORM_OBJECT, authz
from app.db.session import AsyncSessionLocal
from app.models.org import Org, OrgMember
from app.models.project import Project, ProjectMember
from app.models.task import Task
from app.models.user import User


async def _write(user: str, relation: str, obj: str) -> None:
    try:
        await authz.write(user, relation, obj)
        print(f"  + {user} {relation} {obj}")
    except Exception:
        pass  # already exists


async def main() -> None:
    async with AsyncSessionLocal() as db:
        subs = {u.id: u.keycloak_sub for u in (await db.execute(select(User))).scalars().all()}

        print("orgs + org members…")
        for org in (await db.execute(select(Org))).scalars().all():
            await _write(PLATFORM_OBJECT, "platform", f"org:{org.id}")
        for m in (await db.execute(select(OrgMember))).scalars().all():
            await _write(f"user:{subs[m.user_id]}", m.role.value, f"org:{m.org_id}")

        print("projects + project members…")
        for p in (await db.execute(select(Project))).scalars().all():
            await _write(f"org:{p.org_id}", "org", f"project:{p.id}")
        for pm in (await db.execute(select(ProjectMember))).scalars().all():
            await _write(f"user:{subs[pm.user_id]}", pm.role.value, f"project:{pm.project_id}")

        print("tasks + assignees…")
        for t in (await db.execute(select(Task))).scalars().all():
            await _write(f"project:{t.project_id}", "project", f"task:{t.id}")
            if t.assignee_id:
                await _write(f"user:{subs[t.assignee_id]}", "assignee", f"task:{t.id}")

    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
