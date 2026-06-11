"""
JWT authentication dependency.

Flow:
  1. Extract Bearer token from Authorization header
  2. Fetch JWKS from Keycloak (cached in memory for 5 min)
  3. Verify signature, expiry, issuer, and audience
  4. Return decoded token payload as CurrentUser

Day 1 goal: GET /me returns decoded user; missing/bad tokens return 401.
"""

import time
from typing import Annotated

import httpx
import structlog
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt
from jose.utils import base64url_decode
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.telemetry import tracer
from app.db.session import get_db
from app.models.user import User

logger = structlog.get_logger()

# ---------------------------------------------------------------------------
# JWKS cache — avoid fetching on every request
# ---------------------------------------------------------------------------
_jwks_cache: dict = {}
_jwks_cache_at: float = 0
JWKS_CACHE_TTL = 300  # 5 minutes


async def _get_jwks() -> dict:
    global _jwks_cache, _jwks_cache_at
    now = time.time()
    if _jwks_cache and (now - _jwks_cache_at) < JWKS_CACHE_TTL:
        return _jwks_cache

    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(settings.keycloak_jwks_uri, timeout=5.0)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            _jwks_cache_at = now
            logger.info("jwks_refreshed")
            return _jwks_cache
        except Exception as e:
            logger.error("jwks_fetch_failed", error=str(e))
            if _jwks_cache:
                return _jwks_cache  # serve stale rather than hard fail
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Auth service unavailable",
            )


def _find_key(jwks: dict, kid: str):
    """Find the matching public key from JWKS by key ID."""
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


# ---------------------------------------------------------------------------
# Token model
# ---------------------------------------------------------------------------
PLATFORM_ADMIN_ROLE = "platform-admin"


class CurrentUser(BaseModel):
    sub: str          # Keycloak user UUID — stable, use as primary key
    email: str
    username: str     # preferred_username
    given_name: str = ""
    family_name: str = ""
    roles: list[str] = []  # Keycloak realm roles from realm_access.roles

    @property
    def is_platform_admin(self) -> bool:
        return PLATFORM_ADMIN_ROLE in self.roles


# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> CurrentUser:
    """
    Dependency that validates the Bearer JWT and returns the current user.
    Raises 401 for any auth failure.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Decode header without verification to get kid
    try:
        header = jwt.get_unverified_header(token)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format",
        )

    kid = header.get("kid")
    if not kid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing kid",
        )

    # Get JWKS and find the right key
    jwks = await _get_jwks()
    key_data = _find_key(jwks, kid)
    if not key_data:
        # Key might be new — force refresh once
        _jwks_cache_at = 0
        jwks = await _get_jwks()
        key_data = _find_key(jwks, kid)

    if not key_data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unknown signing key",
        )

    # Verify and decode (manual span — one of the three rejection points)
    try:
        with tracer.start_as_current_span("jwt.validate"):
            public_key = jwk.construct(key_data)
            payload = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                audience=settings.keycloak_client_id,
                issuer=settings.keycloak_issuer,
                options={"verify_exp": True},
            )
    except JWTError as e:
        logger.warning("jwt_validation_failed", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token validation failed",
        )

    user = CurrentUser(
        sub=payload["sub"],
        email=payload.get("email", ""),
        username=payload.get("preferred_username", ""),
        given_name=payload.get("given_name", ""),
        family_name=payload.get("family_name", ""),
        roles=payload.get("realm_access", {}).get("roles", []),
    )

    logger.debug("auth_ok", user_id=user.sub, username=user.username)
    return user


# Type alias for cleaner route signatures
AuthUser = Annotated[CurrentUser, Depends(get_current_user)]


# ---------------------------------------------------------------------------
# Lazy user upsert — Day 2
# ---------------------------------------------------------------------------
async def get_db_user(
    current: AuthUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Upsert the local `users` row for the authenticated caller (by `keycloak_sub`)
    and return the persisted ORM object.

    Keycloak owns the user list; this table is a local cache/FK target. The row
    is created on first authenticated request and kept in sync on each call.
    """
    from sqlalchemy.dialects.postgresql import insert

    stmt = (
        insert(User)
        .values(
            keycloak_sub=current.sub,
            email=current.email,
            username=current.username,
        )
        .on_conflict_do_update(
            index_elements=[User.keycloak_sub],
            set_={"email": current.email, "username": current.username},
        )
        .returning(User)
    )
    result = await db.execute(stmt)
    db_user = result.scalar_one()

    # Platform-admins (Keycloak realm role) get the platform tuple so OpenFGA
    # cascades admin to every tenant. Lazy import avoids an auth<->authz cycle.
    if current.is_platform_admin:
        from app.core.authz import ensure_platform_admin_tuple

        await ensure_platform_admin_tuple(current.sub)

    return db_user


DBUser = Annotated[User, Depends(get_db_user)]
