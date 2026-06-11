import time
import uuid

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth import AuthUser, DBUser
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.telemetry import setup_telemetry
from app.db.session import engine

# Day 5: structlog + OpenTelemetry
setup_logging()
logger = structlog.get_logger()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Multi-tenant task manager — learning Keycloak + OpenFGA",
)

# Auto-instrument FastAPI + SQLAlchemy (gives the DB-query span).
setup_telemetry(app, engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    """Bind a correlation id for the request and emit one structured access log
    carrying the full decision context built up during handling (Day 5)."""
    correlation_id = request.headers.get("x-correlation-id", uuid.uuid4().hex[:12])
    structlog.contextvars.clear_contextvars()
    structlog.contextvars.bind_contextvars(
        correlation_id=correlation_id,
        method=request.method,
        path=request.url.path,
    )
    start = time.perf_counter()
    response = await call_next(request)
    response.headers["x-correlation-id"] = correlation_id
    logger.info(
        "request",
        status_code=response.status_code,
        duration_ms=round((time.perf_counter() - start) * 1000, 1),
    )
    return response


# ---------------------------------------------------------------------------
# Health (no auth — used by Docker healthcheck)
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "service": settings.app_name}


# ---------------------------------------------------------------------------
# /me — Day 1 gate: proves JWT validation works end-to-end
# ---------------------------------------------------------------------------
@app.get("/me")
async def get_me(user: AuthUser, db_user: DBUser):
    """
    Returns the decoded identity of the caller.
    AC: valid token → 200 with user info; no/bad token → 401.

    Depending on DBUser also lazily upserts the local `users` row, so the very
    first authenticated request a user makes provisions their row (Day 2 AC).
    """
    logger.info("get_me", user_id=user.sub, username=user.username, local_id=str(db_user.id))
    return {
        "id": str(db_user.id),
        "sub": user.sub,
        "email": user.email,
        "username": user.username,
        "given_name": user.given_name,
        "family_name": user.family_name,
    }


# ---------------------------------------------------------------------------
# /me/permissions — lets the frontend render permission-aware UI (doc 04)
# ---------------------------------------------------------------------------
from app.core.authz import authz  # noqa: E402


@app.get("/me/permissions")
async def my_permissions(object: str, user: AuthUser):
    """
    Effective relations for the caller on an object, e.g. ?object=project:42.
    Returns can_view / can_edit / is_owner so the UI can hide controls. The
    backend still enforces — this is purely a UX convenience.
    """
    obj_type = object.split(":", 1)[0]
    sub = f"user:{user.sub}"
    if obj_type == "project":
        return {
            "can_view": await authz.check(sub, "viewer", object),
            "can_edit": await authz.check(sub, "editor", object),
            "is_owner": await authz.check(sub, "owner", object),
        }
    if obj_type == "task":
        return {
            "can_view": await authz.check(sub, "can_view", object),
            "can_edit": await authz.check(sub, "can_edit", object),
            "is_owner": False,
        }
    if obj_type == "org":
        return {
            "can_view": await authz.check(sub, "member", object),
            "can_edit": await authz.check(sub, "admin", object),
            "is_owner": await authz.check(sub, "admin", object),
        }
    return {"can_view": False, "can_edit": False, "is_owner": False}


# ---------------------------------------------------------------------------
# Routers (Day 2: JWT-gated CRUD; authz wired in Day 3)
# ---------------------------------------------------------------------------
from app.routers import orgs, projects, tasks  # noqa: E402

app.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
