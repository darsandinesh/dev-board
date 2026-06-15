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

import json
import os
import subprocess
from pathlib import Path

# Set BEFORE any app module imports settings:
#  - run the suite against a DEDICATED database so tests never touch dev data
#    (the per-test TRUNCATE below would otherwise wipe the running app's data),
#  - disable the noisy console span exporter.
os.environ["DATABASE_URL"] = "postgresql+asyncpg://devboard:devboard@localhost:5433/devboard_test"
os.environ["ENABLE_TELEMETRY"] = "false"

# CRITICAL: tests get their OWN OpenFGA store. The per-test tuple cleanup wipes
# the whole store, so sharing the dev store would destroy the running app's
# authorization graph. Create a fresh store + model and point the app at it.
_OPENFGA_URL = os.environ.get("OPENFGA_API_URL", "http://localhost:8082")
_MODEL_FILE = Path(__file__).resolve().parents[2] / "infra" / "openfga" / "model.fga"
_created = json.loads(
    subprocess.run(
        [
            "fga",
            "--api-url",
            _OPENFGA_URL,
            "store",
            "create",
            "--name",
            "devboard-pytest",
            "--model",
            str(_MODEL_FILE),
        ],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
)
os.environ["OPENFGA_API_URL"] = _OPENFGA_URL
os.environ["OPENFGA_STORE_ID"] = _created["store"]["id"]
os.environ["OPENFGA_MODEL_ID"] = _created["model"]["authorization_model_id"]

import httpx
import pytest
import pytest_asyncio
from openfga_sdk import ClientConfiguration, OpenFgaClient
from openfga_sdk.client.models import ClientTuple, ClientWriteRequest
from sqlalchemy import text

from app.core import auth
from app.core import authz as authz_mod
from app.core.cache import redis_client
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.main import app
from tests.helpers import bearer, test_jwks  # noqa: F401 (bearer re-exported)


async def _clear_openfga_tuples():
    """Delete every tuple in the store so each test starts from a clean graph."""
    cfg = ClientConfiguration(
        api_url=settings.openfga_api_url,
        store_id=settings.openfga_store_id,
        authorization_model_id=settings.openfga_model_id,
    )
    async with OpenFgaClient(cfg) as fga:
        token = None
        while True:
            opts = {"continuation_token": token} if token else None
            resp = await fga.read(None, options=opts)
            tuples = resp.tuples or []
            if tuples:
                await fga.write(
                    ClientWriteRequest(
                        deletes=[
                            ClientTuple(
                                user=t.key.user, relation=t.key.relation, object=t.key.object
                            )
                            for t in tuples
                        ]
                    )
                )
            token = getattr(resp, "continuation_token", None)
            if not token:
                break


# Safety net: refuse to run if we somehow aren't pointed at the test DB.
assert engine.url.database == "devboard_test", (
    f"tests must run against devboard_test, got {engine.url.database!r}"
)


# --- fixtures ----------------------------------------------------------------
@pytest.fixture(autouse=True)
def _mock_jwks(monkeypatch):
    """Point JWKS verification at our test public key (no Keycloak needed)."""

    async def fake_get_jwks():
        return test_jwks()

    monkeypatch.setattr(auth, "_get_jwks", fake_get_jwks)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_schema():
    """Create the schema in the test DB once per session (drop+recreate)."""
    import app.models  # noqa: F401 — populate Base.metadata

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest_asyncio.fixture(autouse=True)
async def _clean_state():
    """Full isolation per test: wipe Postgres rows, Redis cache, OpenFGA tuples,
    and the platform-admin sync cache (so platform tuples are re-written)."""
    async with engine.begin() as conn:
        await conn.execute(
            text("TRUNCATE tasks, project_members, projects, org_members, orgs, users CASCADE")
        )
    await redis_client.flushdb()
    await _clear_openfga_tuples()
    authz_mod._synced_platform_admins.clear()
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
        r = await self.c.post(
            f"/orgs/{org_id}/members", headers=bearer(admin), json={"user_id": uid, "role": role}
        )
        r.raise_for_status()

    async def project(self, org_id: str, owner: str) -> str:
        await self.provision(owner)
        r = await self.c.post(
            "/projects", headers=bearer(owner), json={"org_id": org_id, "name": "Web"}
        )
        r.raise_for_status()
        return r.json()["id"]

    async def add_project_member(self, project_id: str, owner: str, user: str, role: str):
        uid = await self.provision(user)
        r = await self.c.post(
            f"/projects/{project_id}/members",
            headers=bearer(owner),
            json={"user_id": uid, "role": role},
        )
        r.raise_for_status()

    async def task(self, project_id: str, editor: str, title: str = "X") -> str:
        r = await self.c.post(
            "/tasks", headers=bearer(editor), json={"project_id": project_id, "title": title}
        )
        r.raise_for_status()
        return r.json()["id"]
