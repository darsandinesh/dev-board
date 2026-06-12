"""Phase 1: richer issue fields + comments."""

from tests.helpers import bearer


async def test_create_issue_with_fields(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    r = await client.post(
        "/tasks",
        headers=bearer("alice"),
        json={
            "project_id": proj,
            "title": "Login bug",
            "type": "bug",
            "priority": "high",
            "labels": ["auth", "frontend"],
            "story_points": 5,
            "due_date": "2026-07-01",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert body["type"] == "bug"
    assert body["priority"] == "high"
    assert set(body["labels"]) == {"auth", "frontend"}
    assert body["story_points"] == 5
    assert body["due_date"] == "2026-07-01"


async def test_update_issue_fields(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    tid = await seed.task(proj, editor="alice")
    r = await client.patch(
        f"/tasks/{tid}",
        headers=bearer("alice"),
        json={"priority": "urgent", "labels": ["p0"], "type": "story"},
    )
    assert r.status_code == 200
    assert r.json()["priority"] == "urgent"
    assert r.json()["type"] == "story"
    assert r.json()["labels"] == ["p0"]


async def test_comments_create_and_list(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    tid = await seed.task(proj, editor="alice")
    # alice (owner) comments
    r = await client.post(
        f"/tasks/{tid}/comments", headers=bearer("alice"), json={"body": "Looks good"}
    )
    assert r.status_code == 201
    assert r.json()["author_username"] == "alice"
    # list shows it
    lst = await client.get(f"/tasks/{tid}/comments", headers=bearer("alice"))
    assert lst.status_code == 200
    assert any(c["body"] == "Looks good" for c in lst.json())


async def test_comments_require_view_access(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    tid = await seed.task(proj, editor="alice")
    await seed.provision("carol")  # carol has no access to this task
    assert (
        await client.get(f"/tasks/{tid}/comments", headers=bearer("carol"))
    ).status_code == 403
    assert (
        await client.post(
            f"/tasks/{tid}/comments", headers=bearer("carol"), json={"body": "hi"}
        )
    ).status_code == 403


async def test_issue_keys_and_seq(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    # project has a key prefix
    p = (await client.get(f"/projects/{proj}", headers=bearer("alice"))).json()
    assert p["key"]  # e.g. "WEB"
    # tasks get incrementing per-project seq
    t1 = await client.post("/tasks", headers=bearer("alice"), json={"project_id": proj, "title": "one"})
    t2 = await client.post("/tasks", headers=bearer("alice"), json={"project_id": proj, "title": "two"})
    assert t1.json()["seq"] == 1
    assert t2.json()["seq"] == 2


async def test_activity_logged(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    tid = await seed.task(proj, editor="alice")
    await client.patch(f"/tasks/{tid}", headers=bearer("alice"), json={"status": "done"})
    acts = (await client.get(f"/tasks/{tid}/activity", headers=bearer("alice"))).json()
    actions = {a["action"] for a in acts}
    assert "created" in actions
    assert "status" in actions


async def test_epic_parent_and_children(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    epic = await client.post("/tasks", headers=bearer("alice"),
                             json={"project_id": proj, "title": "Epic", "type": "epic"})
    epic_id = epic.json()["id"]
    assert epic.json()["type"] == "epic"
    child = await client.post("/tasks", headers=bearer("alice"),
                              json={"project_id": proj, "title": "Story", "parent_id": epic_id})
    assert child.json()["parent_id"] == epic_id
    kids = await client.get(f"/tasks/{epic_id}/children", headers=bearer("alice"))
    assert kids.status_code == 200
    assert any(c["title"] == "Story" for c in kids.json())


async def test_issue_links(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    a = await seed.task(proj, editor="alice")
    b = await seed.task(proj, editor="alice")
    r = await client.post(f"/tasks/{a}/links", headers=bearer("alice"),
                          json={"target_id": b, "link_type": "blocks"})
    assert r.status_code == 201
    links = await client.get(f"/tasks/{a}/links", headers=bearer("alice"))
    assert any(l["link_type"] == "blocks" and l["target_id"] == b for l in links.json())
    # self-link rejected
    bad = await client.post(f"/tasks/{a}/links", headers=bearer("alice"),
                            json={"target_id": a, "link_type": "relates_to"})
    assert bad.status_code == 400


async def test_assignment_notifies(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    await seed.add_project_member(proj, owner="alice", user="bob", role="editor")
    bob_id = await seed.provision("bob")
    await client.post("/tasks", headers=bearer("alice"),
                      json={"project_id": proj, "title": "For bob", "assignee_id": bob_id})
    notes = (await client.get("/notifications", headers=bearer("bob"))).json()
    assert any(n["kind"] == "assigned" and not n["is_read"] for n in notes)


async def test_mention_notifies(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    await seed.add_project_member(proj, owner="alice", user="bob", role="editor")
    await seed.provision("bob")
    tid = await seed.task(proj, editor="alice")
    await client.post(f"/tasks/{tid}/comments", headers=bearer("alice"),
                      json={"body": "hey @bob please look"})
    notes = (await client.get("/notifications", headers=bearer("bob"))).json()
    assert any(n["kind"] == "mentioned" for n in notes)
    # mark all read
    assert (await client.post("/notifications/read-all", headers=bearer("bob"))).status_code == 204
    after = (await client.get("/notifications", headers=bearer("bob"))).json()
    assert all(n["is_read"] for n in after)


async def test_assignee_can_comment(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    await seed.add_project_member(proj, owner="alice", user="carol", role="viewer")
    carol_id = await seed.provision("carol")
    # task assigned to carol -> she can_view -> can comment
    created = await client.post(
        "/tasks", headers=bearer("alice"),
        json={"project_id": proj, "title": "Carol's", "assignee_id": carol_id},
    )
    tid = created.json()["id"]
    r = await client.post(
        f"/tasks/{tid}/comments", headers=bearer("carol"), json={"body": "on it"}
    )
    assert r.status_code == 201
