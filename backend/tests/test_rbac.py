"""
The 5-role model:
  platform-admin  global super admin — creates tenants, full access (cascade)
  tenant-admin    org admin — full access within the tenant (all its projects)
  Admin           project owner — manage project + members + tasks
  Developer       project editor — create/update tasks
  viewer          sees only the tasks assigned to them; no operations
"""

from tests.helpers import bearer


# --- platform-admin ----------------------------------------------------------
async def test_only_platform_admin_creates_tenant(client, seed):
    await seed.provision("bob")
    assert (await client.post("/orgs", headers=bearer("bob"), json={"name": "X"})).status_code == 403
    assert (await client.post("/orgs", headers=bearer("alice"), json={"name": "Y"})).status_code == 201


async def test_me_reports_platform_admin(client):
    alice = (await client.get("/me", headers=bearer("alice"))).json()
    bob = (await client.get("/me", headers=bearer("bob"))).json()
    assert alice["is_platform_admin"] is True
    assert bob["is_platform_admin"] is False


# --- tenant-admin ------------------------------------------------------------
async def test_tenant_admin_sees_all_projects_in_tenant(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")  # private to alice
    await seed.add_org_member(org, admin="alice", user="dave", role="admin")  # tenant-admin
    listed = {p["id"] for p in (await client.get("/projects", headers=bearer("dave"))).json()}
    assert proj in listed  # tenant-admin sees it without an explicit project tuple


# --- viewer (assigned-only) --------------------------------------------------
async def test_viewer_sees_only_assigned_tasks(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    carol_id = await seed.provision("carol")
    await seed.add_project_member(proj, owner="alice", user="carol", role="viewer")

    await client.post("/tasks", headers=bearer("alice"),
                      json={"project_id": proj, "title": "Assigned", "assignee_id": carol_id})
    await client.post("/tasks", headers=bearer("alice"),
                      json={"project_id": proj, "title": "Unassigned"})

    carol_titles = {t["title"] for t in
                    (await client.get(f"/tasks?project_id={proj}", headers=bearer("carol"))).json()}
    assert carol_titles == {"Assigned"}  # viewer: only their assigned task

    alice_titles = {t["title"] for t in
                    (await client.get(f"/tasks?project_id={proj}", headers=bearer("alice"))).json()}
    assert {"Assigned", "Unassigned"} <= alice_titles  # editor+ sees everything


async def test_viewer_cannot_create_or_edit(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    carol_id = await seed.provision("carol")
    await seed.add_project_member(proj, owner="alice", user="carol", role="viewer")
    task = await client.post("/tasks", headers=bearer("alice"),
                             json={"project_id": proj, "title": "T", "assignee_id": carol_id})
    tid = task.json()["id"]
    # viewer can view their assigned task but cannot edit it, nor create new ones
    assert (await client.get(f"/tasks/{tid}", headers=bearer("carol"))).status_code == 200
    assert (await client.patch(f"/tasks/{tid}", headers=bearer("carol"),
                               json={"status": "done"})).status_code == 403
    assert (await client.post("/tasks", headers=bearer("carol"),
                              json={"project_id": proj, "title": "nope"})).status_code == 403
