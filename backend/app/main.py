import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth import AuthUser, DBUser
from app.core.config import settings

# Configure structlog
structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer() if settings.debug else structlog.processors.JSONRenderer(),
    ]
)

logger = structlog.get_logger()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Multi-tenant task manager — learning Keycloak + OpenFGA",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
# Routers (Day 2: JWT-gated CRUD; authz wired in Day 3)
# ---------------------------------------------------------------------------
from app.routers import orgs, projects, tasks  # noqa: E402

app.include_router(orgs.router, prefix="/orgs", tags=["orgs"])
app.include_router(projects.router, prefix="/projects", tags=["projects"])
app.include_router(tasks.router, prefix="/tasks", tags=["tasks"])
