"""
OpenFGA authorization client + the `require()` FastAPI dependency.

Day 3: real check()/write()/delete() against OpenFGA, and the `require()` gate
attached to every endpoint.

Tuple subjects are OpenFGA object strings, e.g. "user:<keycloak_sub>",
"org:<uuid>", "project:<uuid>". We always identify users by their Keycloak
`sub` so the OpenFGA user id matches the JWT subject.

> Redis caching is wired in Day 5. For now `_redis` is None and check() always
> hits OpenFGA; the cache code paths are no-ops until a client is injected.
"""

from typing import Annotated

import structlog
from fastapi import Depends, HTTPException, Request, status
from openfga_sdk import ClientConfiguration, OpenFgaClient
from openfga_sdk.client.models import (
    ClientCheckRequest,
    ClientListObjectsRequest,
    ClientTuple,
    ClientWriteRequest,
)

from app.core.auth import AuthUser
from app.core.cache import redis_client
from app.core.config import settings
from app.core.telemetry import tracer

logger = structlog.get_logger()


class Authz:
    """OpenFGA client wrapper: relationship checks + tuple writes/deletes."""

    def __init__(self, api_url: str, store_id: str, model_id: str, redis=None):
        self._cfg = ClientConfiguration(
            api_url=api_url,
            store_id=store_id,
            authorization_model_id=model_id or None,
        )
        self._redis = redis  # Day 5

    # -- queries ------------------------------------------------------------
    async def check(self, user: str, relation: str, obj: str) -> bool:
        """Does `user` have `relation` on object `obj`? e.g.
        check("user:<sub>", "viewer", "project:<id>")."""
        with tracer.start_as_current_span("openfga.check") as span:
            span.set_attribute("authz.user", user)
            span.set_attribute("authz.relation", relation)
            span.set_attribute("authz.object", obj)

            key = f"authz:{user}:{relation}:{obj}"
            if self._redis is not None:
                cached = await self._redis.get(key)
                if cached is not None:
                    allowed = cached == b"1"
                    span.set_attribute("authz.cache", "hit")
                    span.set_attribute("authz.allowed", allowed)
                    logger.debug("authz_check", user=user, relation=relation,
                                 object=obj, allowed=allowed, cache="hit")
                    return allowed

            async with OpenFgaClient(self._cfg) as fga:
                resp = await fga.check(
                    ClientCheckRequest(user=user, relation=relation, object=obj)
                )
            allowed = bool(resp.allowed)

            if self._redis is not None:
                await self._redis.set(key, b"1" if allowed else b"0", ex=30)
            span.set_attribute("authz.cache", "miss")
            span.set_attribute("authz.allowed", allowed)
            logger.debug("authz_check", user=user, relation=relation,
                         object=obj, allowed=allowed, cache="miss")
            return allowed

    async def list_objects(self, user: str, relation: str, obj_type: str) -> list[str]:
        """Return every object of `obj_type` on which `user` has `relation`,
        as bare ids (the "type:" prefix stripped). Used by GET /projects."""
        async with OpenFgaClient(self._cfg) as fga:
            resp = await fga.list_objects(
                ClientListObjectsRequest(user=user, relation=relation, type=obj_type)
            )
        prefix = f"{obj_type}:"
        return [o[len(prefix):] if o.startswith(prefix) else o for o in resp.objects]

    # -- mutations ----------------------------------------------------------
    async def write(self, user: str, relation: str, obj: str) -> None:
        async with OpenFgaClient(self._cfg) as fga:
            await fga.write(
                ClientWriteRequest(
                    writes=[ClientTuple(user=user, relation=relation, object=obj)]
                )
            )
        logger.debug("authz_write", user=user, relation=relation, object=obj)
        await self._invalidate(user)

    async def delete(self, user: str, relation: str, obj: str) -> None:
        async with OpenFgaClient(self._cfg) as fga:
            await fga.write(
                ClientWriteRequest(
                    deletes=[ClientTuple(user=user, relation=relation, object=obj)]
                )
            )
        logger.debug("authz_delete", user=user, relation=relation, object=obj)
        await self._invalidate(user)

    async def _invalidate(self, user: str) -> None:
        """Drop all cached answers for a user (Day 5; no-op without redis)."""
        if self._redis is None:
            return
        async for k in self._redis.scan_iter(f"authz:{user}:*"):
            await self._redis.delete(k)


# Singleton — configured from .env (store/model ids set by bootstrap.sh).
authz = Authz(
    api_url=settings.openfga_api_url,
    store_id=settings.openfga_store_id,
    model_id=settings.openfga_model_id,
    redis=redis_client,  # Day 5: 30s decision cache + per-user invalidation
)


def get_authz() -> Authz:
    return authz


# ---------------------------------------------------------------------------
# The gate: require(relation, obj_type) — checks the JWT subject against the
# object identified by a path parameter.
# ---------------------------------------------------------------------------
def require(relation: str, obj_type: str, id_param: str):
    """
    FastAPI dependency factory. Reads the object id from `request.path_params`
    under `id_param`, then checks `relation` for the caller. Raises 403 if denied.

    Usage:
        dependencies=[Depends(require("viewer", "project", "project_id"))]
    """

    async def _dep(request: Request, current: AuthUser) -> None:
        obj_id = request.path_params.get(id_param)
        allowed = await authz.check(
            user=f"user:{current.sub}",
            relation=relation,
            obj=f"{obj_type}:{obj_id}",
        )
        if not allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden")

    return _dep


# Convenience for object ids built from the request body / query (not the path):
# routers call authz.check(...) inline for those (POST /projects, POST /tasks,
# GET /projects, GET /tasks?project_id).
AuthzDep = Annotated[Authz, Depends(get_authz)]
