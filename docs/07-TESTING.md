# 07 — Testing

Day 6. The brief's rule: **test auth failures as hard as successes.** A 403 you understand is worth more than a 200 you don't.

## What to test, at which layer

| Layer | Tool | Focus |
|---|---|---|
| Unit | pytest | JWT validation edge cases, the `require()` dependency, cache hit/miss logic |
| Integration | pytest + httpx + test Postgres + real OpenFGA | full endpoint behavior with real authz checks |
| E2E | manual or Playwright | login → create org → project → invite → verify access |

> Note: For integration tests, run OpenFGA and Postgres from compose (or testcontainers) — **don't mock OpenFGA.** The point of the week is that the real check works. Mock only Keycloak (mint your own JWTs with a test keypair) so tests don't depend on a running Keycloak.

## Test JWTs without Keycloak

Generate an RSA keypair for tests. Sign tokens with the private key; point the backend's JWKS verification at the public key (via a test override of the JWKS fetch). Then you can mint a token for any `sub` instantly:

```python
def make_token(sub: str, email="t@t.io", username="t"):
    return jwt.encode(
        {"sub": sub, "email": email, "preferred_username": username,
         "iss": settings.KEYCLOAK_ISSUER, "aud": settings.KEYCLOAK_AUDIENCE,
         "exp": int(time.time()) + 300},
        TEST_PRIVATE_KEY, algorithm="RS256",
        headers={"kid": TEST_KID})
```

## The auth test matrix (must-pass)

| # | Scenario | Setup | Request | Expect |
|---|---|---|---|---|
| 1 | No token | — | `GET /me` no header | 401 |
| 2 | Garbage token | — | random string | 401 |
| 3 | Expired token | mint exp in past | any | 401 |
| 4 | Wrong realm/issuer | sign with wrong `iss` | any | 401 |
| 5 | Wrong audience | `aud=other` | any | 401 |
| 6 | Valid token, no perms | carol, no tuples | `GET /projects/{id}` | 403/404 |
| 7 | Org admin views org project | alice admin of acme | `GET /projects/{p in acme}` | 200 (member-from-org) |
| 8 | Viewer tries to edit | bob viewer | `PATCH /tasks/{id}` | 403 |
| 9 | Editor edits | bob editor | `PATCH /tasks/{id}` | 200 |
| 10 | Owner implies editor | dave owner only | `PATCH /tasks/{id}` | 200 |
| 11 | Non-admin creates project | bob member | `POST /projects` | 403 |
| 12 | Admin creates project | alice admin | `POST /projects` | 201 + tuples written |
| 13 | Role revoked | demote editor→viewer, wait TTL | `PATCH /tasks/{id}` | 403 within 30s |

Cases 1–5 prove your **AuthN**. Cases 6–13 prove your **AuthZ**. Case 13 proves your **cache invalidation**.

## Integration test sketch

```python
@pytest.mark.asyncio
async def test_viewer_cannot_edit_task(client, seed):
    org = await seed.org(admin="alice")
    proj = await seed.project(org, owner="alice")
    task = await seed.task(proj, title="X")
    await seed.add_project_member(proj, user="bob", role="viewer")  # writes row + tuple

    r = await client.patch(f"/tasks/{task.id}",
                           json={"status": "done"},
                           headers=bearer("bob"))
    assert r.status_code == 403
```

`seed` helpers must write **both** the Postgres row and the OpenFGA tuple — exactly what the real service does. If a test passes because you only wrote the row (or only the tuple), it's lying. Reuse the production write path in seeds.

## Cache invalidation test (case 13)

```python
async def test_revocation_takes_effect(client, seed, authz):
    ...  # bob is editor, can PATCH → 200
    await client.patch(f"/projects/{proj.id}/members/{bob}",
                       json={"role": "viewer"}, headers=bearer("alice"))  # demote
    # invalidation should have wiped bob's cache immediately
    r = await client.patch(f"/tasks/{task.id}", json={"status":"done"}, headers=bearer("bob"))
    assert r.status_code == 403
```

If this fails intermittently, your invalidation isn't wiping `authz:user:bob:*`. The 30s TTL is a backstop, not the mechanism.

## E2E flow (Day 6 deliverable)

Login → create org → create project → invite member → verify member access. Do it once by hand through the UI, then optionally script with Playwright:

1. alice logs in via Keycloak, lands on `/`.
2. alice creates org "Acme", creates project "Web".
3. alice opens settings, invites bob as `editor`.
4. bob logs in → sees "Web" in his list → can move task cards.
5. alice demotes bob to `viewer` → bob's edit buttons disappear, PATCH returns 403.

## Coverage targets (don't over-invest)

- 100% of the auth matrix above — non-negotiable.
- Happy-path CRUD for each resource — one test each.
- Skip exhaustive validation testing; this is a learning build, not a product.
