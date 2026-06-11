"""
Integration test harness (Day 6).

- Keycloak is MOCKED: we mint our own RS256 JWTs with a local keypair and point
  the backend's JWKS verification at the matching public key. iss/aud match
  settings so real validation runs.
- OpenFGA + Postgres + Redis are REAL (from docker compose) — the whole point is
  that the real relationship checks work. Seed helpers drive the actual API
  endpoints, so every seed writes BOTH the Postgres row and the OpenFGA tuple,
  exactly like production.

Requires the stack up: docker compose up -d postgres redis openfga
"""

import os

# Disable the console span exporter during tests (noisy + writes to closed
# stdout after capture). Must be set before any app module imports settings.
os.environ["ENABLE_TELEMETRY"] = "false"

import httpx
import pytest
import pytest_asyncio
from sqlalchemy import text

from app.core import auth
from app.core.cache import redis_client
from app.db.session import engine
from app.main import app
from tests.helpers import bearer, test_jwks  # noqa: F401 (bearer re-exported)


# --- fixtures ----------------------------------------------------------------
@pytest.fixture(autouse=True)
def _mock_jwks(monkeypatch):
    """Point JWKS verification at our test public key (no Keycloak needed)."""
    async def fake_get_jwks():
        return test_jwks()
    monkeypatch.setattr(auth, "_get_jwks", fake_get_jwks)


@pytest_asyncio.fixture(autouse=True)
async def _clean_state():
    """Wipe Postgres rows + Redis cache before each test for isolation.
    (OpenFGA tuples use fresh UUIDs per test, so they don't collide.)"""
    async with engine.begin() as conn:
        await conn.execute(text(
            "TRUNCATE tasks, project_members, projects, org_members, orgs, users CASCADE"
        ))
    await redis_client.flushdb()
    yield


@pytest_asyncio.fixture
async def client():
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def seed(client):
    """Seed helper that builds state through the real API (row + tuple writes)."""
    return Seeder(client)


class Seeder:
    def __init__(self, client: httpx.AsyncClient):
        self.c = client
        self._local_ids: dict[str, str] = {}

    async def provision(self, sub: str) -> str:
        """Ensure the user's local row exists; return their local user id."""
        if sub not in self._local_ids:
            r = await self.c.get("/me", headers=bearer(sub))
            r.raise_for_status()
            self._local_ids[sub] = r.json()["id"]
        return self._local_ids[sub]

    async def org(self, admin: str) -> str:
        await self.provision(admin)
        r = await self.c.post("/orgs", headers=bearer(admin), json={"name": "Acme"})
        r.raise_for_status()
        return r.json()["id"]

    async def add_org_member(self, org_id: str, admin: str, user: str, role: str):
        uid = await self.provision(user)
        r = await self.c.post(f"/orgs/{org_id}/members", headers=bearer(admin),
                              json={"user_id": uid, "role": role})
        r.raise_for_status()

    async def project(self, org_id: str, owner: str) -> str:
        await self.provision(owner)
        r = await self.c.post("/projects", headers=bearer(owner),
                              json={"org_id": org_id, "name": "Web"})
        r.raise_for_status()
        return r.json()["id"]

    async def add_project_member(self, project_id: str, owner: str, user: str, role: str):
        uid = await self.provision(user)
        r = await self.c.post(f"/projects/{project_id}/members", headers=bearer(owner),
                              json={"user_id": uid, "role": role})
        r.raise_for_status()

    async def task(self, project_id: str, editor: str, title: str = "X") -> str:
        r = await self.c.post("/tasks", headers=bearer(editor),
                              json={"project_id": project_id, "title": title})
        r.raise_for_status()
        return r.json()["id"]
