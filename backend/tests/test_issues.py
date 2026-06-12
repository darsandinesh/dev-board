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
