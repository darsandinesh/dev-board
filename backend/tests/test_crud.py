"""Happy-path CRUD per resource (doc 07: one test each)."""

from tests.helpers import bearer


async def test_me_provisions_user(client):
    r = await client.get("/me", headers=bearer("alice"))
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "alice" and "id" in body
    # second call doesn't duplicate (still 200, same id)
    r2 = await client.get("/me", headers=bearer("alice"))
    assert r2.json()["id"] == body["id"]


async def test_org_create_and_members(client, seed):
    org = await seed.org(admin="alice")
    await seed.add_org_member(org, admin="alice", user="bob", role="member")
    r = await client.get(f"/orgs/{org}/members", headers=bearer("alice"))
    assert r.status_code == 200
    usernames = {m["username"] for m in r.json()}
    assert {"alice", "bob"} <= usernames


async def test_project_lifecycle(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    # appears in alice's list with owner role
    listing = await client.get("/projects", headers=bearer("alice"))
    assert any(p["id"] == proj and p["my_role"] == "owner" for p in listing.json())


async def test_task_crud_cycle(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    # create
    created = await client.post("/tasks", headers=bearer("alice"),
                                json={"project_id": proj, "title": "Ship it"})
    assert created.status_code == 201
    tid = created.json()["id"]
    # read (list)
    lst = await client.get(f"/tasks?project_id={proj}", headers=bearer("alice"))
    assert any(t["id"] == tid for t in lst.json())
    # update
    upd = await client.patch(f"/tasks/{tid}", headers=bearer("alice"),
                             json={"status": "done", "position": 2})
    assert upd.status_code == 200 and upd.json()["status"] == "done"
    # delete
    assert (await client.delete(f"/tasks/{tid}", headers=bearer("alice"))).status_code == 204
    assert (await client.get(f"/tasks/{tid}", headers=bearer("alice"))).status_code in (403, 404)


async def test_validation_error_shape(client):
    # missing required 'name' -> 422 with consistent envelope
    r = await client.post("/orgs", headers=bearer("alice"), json={})
    assert r.status_code == 422
    body = r.json()
    assert body["status"] == 422 and "detail" in body
