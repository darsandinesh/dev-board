"""
Day-3 authz gate, end-to-end against the running stack.

Proves the core insight: an org admin/member can view a project in their org
with NO project-level tuple (the `member from org` traversal), while a non-member
is forbidden, and a viewer cannot edit.

Run: python scripts/day3-authz-test.py   (API on :8000, Keycloak on :8080)
"""

import asyncio
import sys

import httpx

KC = "http://localhost:8080/realms/devboard/protocol/openid-connect/token"
API = "http://127.0.0.1:8000"
CLIENT_ID = "devboard-app"
CLIENT_SECRET = "devboard-secret"

PASS, FAIL = "\033[92mPASS\033[0m", "\033[91mFAIL\033[0m"
results = []


def check(label, got, expected):
    ok = got == expected
    results.append(ok)
    print(f"  [{PASS if ok else FAIL}] {label}: got {got}, expected {expected}")


async def token(client, username):
    r = await client.post(
        KC,
        data={
            "grant_type": "password",
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "username": username,
            "password": "password123",
        },
    )
    r.raise_for_status()
    return r.json()["access_token"]


def h(tok):
    return {"Authorization": f"Bearer {tok}"}


async def main():
    async with httpx.AsyncClient(timeout=10) as c:
        alice = await token(c, "alice")
        bob = await token(c, "bob")
        carol = await token(c, "carol")

        # Each calls /me once so their local user row is upserted; /me returns local id.
        local_ids = {}
        for name, tok in [("alice", alice), ("bob", bob), ("carol", carol)]:
            r = await c.get(f"{API}/me", headers=h(tok))
            check(f"/me {name}", r.status_code, 200)
            local_ids[name] = r.json()["id"]
        # no-token and bad-token
        check("/me no token -> 401", (await c.get(f"{API}/me")).status_code, 401)
        check("/me garbage -> 401", (await c.get(f"{API}/me", headers=h("garbage"))).status_code, 401)

        bob_local_id = local_ids["bob"]

        print("\n-- alice creates org + project --")
        r = await c.post(f"{API}/orgs", headers=h(alice), json={"name": "Acme"})
        check("alice POST /orgs -> 201", r.status_code, 201)
        org_id = r.json()["id"]

        r = await c.post(f"{API}/projects", headers=h(alice),
                         json={"org_id": org_id, "name": "Website"})
        check("alice POST /projects -> 201", r.status_code, 201)
        project_id = r.json()["id"]

        check("alice GET /projects/{id} (owner) -> 200",
              (await c.get(f"{API}/projects/{project_id}", headers=h(alice))).status_code, 200)

        print("\n-- bob is NOT in the org yet --")
        check("bob GET /projects/{id} -> 403 (no relation)",
              (await c.get(f"{API}/projects/{project_id}", headers=h(bob))).status_code, 403)
        check("carol GET /projects/{id} -> 403",
              (await c.get(f"{API}/projects/{project_id}", headers=h(carol))).status_code, 403)

        print("\n-- alice adds bob to the ORG as plain member (no project tuple for bob) --")
        r = await c.post(f"{API}/orgs/{org_id}/members", headers=h(alice),
                         json={"user_id": bob_local_id, "role": "member"})
        check("alice POST /orgs/{id}/members -> 201", r.status_code, 201)

        print("\n-- THE GATE: bob views the project via member-from-org, no project tuple --")
        check("bob GET /projects/{id} -> 200 (member-from-org viewer)",
              (await c.get(f"{API}/projects/{project_id}", headers=h(bob))).status_code, 200)

        check("bob appears in GET /projects list",
              project_id in [p["id"] for p in (await c.get(f"{API}/projects", headers=h(bob))).json()], True)

        print("\n-- bob is viewer, not editor: cannot create tasks --")
        r = await c.post(f"{API}/tasks", headers=h(bob),
                         json={"project_id": project_id, "title": "nope"})
        check("bob POST /tasks -> 403 (viewer can't edit)", r.status_code, 403)

        print("\n-- alice (editor via owner) creates a task, then can_edit/can_view traversal --")
        r = await c.post(f"{API}/tasks", headers=h(alice),
                         json={"project_id": project_id, "title": "Design homepage"})
        check("alice POST /tasks -> 201", r.status_code, 201)
        task_id = r.json()["id"]
        check("bob GET /tasks/{id} -> 200 (can_view via project viewer)",
              (await c.get(f"{API}/tasks/{task_id}", headers=h(bob))).status_code, 200)
        check("bob PATCH /tasks/{id} -> 403 (can_edit denied)",
              (await c.patch(f"{API}/tasks/{task_id}", headers=h(bob), json={"status": "done"})).status_code, 403)
        check("alice PATCH /tasks/{id} -> 200",
              (await c.patch(f"{API}/tasks/{task_id}", headers=h(alice), json={"status": "done"})).status_code, 200)

        print(f"\n{'='*50}\n{sum(results)}/{len(results)} checks passed")
        sys.exit(0 if all(results) else 1)


asyncio.run(main())
