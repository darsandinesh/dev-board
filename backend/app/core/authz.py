"""
OpenFGA authorization client.

Day 1: Stub — check() always returns True so CRUD works without authz.
Day 3: Real implementation — check(), write(), delete() against OpenFGA API.

The pattern you're learning:
    allowed = await authz.check(user_id, "editor", "project", project_id)
    if not allowed:
        raise HTTPException(403)
"""

import structlog

from app.core.config import settings

logger = structlog.get_logger()


class Authz:
    """
    OpenFGA client wrapper.
    - Day 1: stub, always allows (so we can build CRUD first)
    - Day 3: real checks, tuple writes, Redis cache
    """

    async def check(
        self,
        user_id: str,
        relation: str,
        obj_type: str,
        obj_id: str,
    ) -> bool:
        """
        Ask OpenFGA: does user have `relation` on `obj_type:obj_id`?

        Day 3 will replace this with:
            response = await self._client.check(...)
            return response.allowed
        """
        logger.debug(
            "authz_check_stub",
            user=user_id,
            relation=relation,
            object=f"{obj_type}:{obj_id}",
            note="Always True until Day 3",
        )
        return True  # TODO Day 3: replace with real OpenFGA check

    async def write(
        self,
        user_id: str,
        relation: str,
        obj_type: str,
        obj_id: str,
    ) -> None:
        """Write a relationship tuple to OpenFGA."""
        logger.debug(
            "authz_write_stub",
            user=user_id,
            relation=relation,
            object=f"{obj_type}:{obj_id}",
        )
        # TODO Day 3: implement

    async def delete(
        self,
        user_id: str,
        relation: str,
        obj_type: str,
        obj_id: str,
    ) -> None:
        """Delete a relationship tuple from OpenFGA."""
        logger.debug(
            "authz_delete_stub",
            user=user_id,
            relation=relation,
            object=f"{obj_type}:{obj_id}",
        )
        # TODO Day 3: implement


# Singleton — import this everywhere
authz = Authz()
