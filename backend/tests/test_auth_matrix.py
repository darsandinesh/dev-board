"""
The auth test matrix (doc 07) — must pass.

Cases 1-5 prove AuthN (JWT validation). Cases 6-13 prove AuthZ (OpenFGA).
Case 13 proves cache invalidation. Users: alice/bob/carol/dave (any sub works;
Keycloak is mocked). OpenFGA + Postgres + Redis are real.
"""

from tests.helpers import bearer, make_token  # noqa: F401


# --- AuthN (1-5) -------------------------------------------------------------
async def test_01_no_token(client):
    r = await client.get("/me")
    assert r.status_code == 401


async def test_02_garbage_token(client):
    r = await client.get("/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401


async def test_03_expired_token(client):
    r = await client.get("/me", headers=bearer("alice", exp_offset=-300))
    assert r.status_code == 401


async def test_04_wrong_issuer(client):
    r = await client.get("/me", headers=bearer("alice", iss="http://evil/realms/x"))
    assert r.status_code == 401


async def test_05_wrong_audience(client):
    r = await client.get("/me", headers=bearer("alice", aud="some-other-client"))
    assert r.status_code == 401


# --- AuthZ (6-13) ------------------------------------------------------------
async def test_06_valid_token_no_perms(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    await seed.provision("carol")
    r = await client.get(f"/projects/{proj}", headers=bearer("carol"))
    assert r.status_code == 403


async def test_07_private_projects_member_denied_tenant_admin_allowed(client, seed):
    # Private projects: a plain org MEMBER has no tuple on this non-default
    # project -> denied. A tenant-admin (org admin) sees it via the cascade
    # (admin from org -> project owner).
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")  # a non-default project
    await seed.add_org_member(org, admin="alice", user="bob", role="member")
    await seed.add_org_member(org, admin="alice", user="dave", role="admin")
    assert (await client.get(f"/projects/{proj}", headers=bearer("bob"))).status_code == 403
    assert (await client.get(f"/projects/{proj}", headers=bearer("dave"))).status_code == 200


async def test_08_viewer_cannot_edit(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    task = await seed.task(proj, editor="alice")
    await seed.add_project_member(proj, owner="alice", user="bob", role="viewer")
    r = await client.patch(f"/tasks/{task}", headers=bearer("bob"), json={"status": "done"})
    assert r.status_code == 403


async def test_09_editor_edits(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    task = await seed.task(proj, editor="alice")
    await seed.add_project_member(proj, owner="alice", user="bob", role="editor")
    r = await client.patch(f"/tasks/{task}", headers=bearer("bob"), json={"status": "done"})
    assert r.status_code == 200


async def test_10_owner_implies_editor(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    task = await seed.task(proj, editor="alice")
    await seed.add_project_member(proj, owner="alice", user="dave", role="owner")
    # dave is owner only; owner ⇒ editor ⇒ can_edit
    r = await client.patch(f"/tasks/{task}", headers=bearer("dave"), json={"status": "done"})
    assert r.status_code == 200


async def test_11_non_admin_creates_project(client, seed):
    org = await seed.org(admin="alice")
    await seed.add_org_member(org, admin="alice", user="bob", role="member")
    bob_can = await client.post(
        "/projects", headers=bearer("bob"), json={"org_id": org, "name": "Nope"}
    )
    assert bob_can.status_code == 403


async def test_12_admin_creates_project(client, seed):
    org = await seed.org(admin="alice")
    r = await client.post(
        "/projects", headers=bearer("alice"), json={"org_id": org, "name": "Web2"}
    )
    assert r.status_code == 201
    # tuple written -> alice (owner) can immediately view it
    pid = r.json()["id"]
    assert (await client.get(f"/projects/{pid}", headers=bearer("alice"))).status_code == 200


async def test_13_role_revoked_invalidates_cache(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    task = await seed.task(proj, editor="alice")
    await seed.add_project_member(proj, owner="alice", user="bob", role="editor")
    # bob can edit (and this caches the allow decision)
    assert (
        await client.patch(f"/tasks/{task}", headers=bearer("bob"), json={"status": "in_progress"})
    ).status_code == 200
    # demote bob editor -> viewer (must invalidate his cached decisions)
    bob_uid = await seed.provision("bob")
    demote = await client.patch(
        f"/projects/{proj}/members/{bob_uid}", headers=bearer("alice"), json={"role": "viewer"}
    )
    assert demote.status_code == 200
    # immediately (well within 30s TTL) bob is forbidden
    r = await client.patch(f"/tasks/{task}", headers=bearer("bob"), json={"status": "done"})
    assert r.status_code == 403
