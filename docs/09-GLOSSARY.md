# 09 — Glossary

Quick reference for the terms used across these docs.

## Auth concepts

**Authentication (AuthN)** — proving *who you are*. Handled by Keycloak. Output: a verified identity (the `sub`).

**Authorization (AuthZ)** — deciding *what you may do*. Handled by OpenFGA. Output: allow/deny for (user, action, resource).

**OIDC (OpenID Connect)** — an identity layer on top of OAuth2. Keycloak speaks OIDC; it issues ID/access tokens after a login flow.

**OAuth2 Authorization Code flow** — the redirect-based login dance: app → Keycloak login page → redirect back with a code → app exchanges code for tokens (server-side, with the client secret). next-auth does the exchange.

**JWT (JSON Web Token)** — a signed, base64 token carrying claims. We verify its signature against Keycloak's public keys (JWKS) and check `exp`, `iss`, `aud`.

**JWKS (JSON Web Key Set)** — the public keys Keycloak publishes so anyone can verify its tokens without a shared secret. Fetched from the realm's `/protocol/openid-connect/certs` and cached.

**Claims** — fields inside a JWT (`sub`, `email`, `exp`, `iss`, `aud`, `preferred_username`). We trust identity claims, never permission claims.

- `sub` — subject; the stable unique user id. Our join key to the `users` table.
- `iss` — issuer; must equal the realm URL we expect.
- `aud` — audience; must include our client (`devboard-app`).
- `exp` — expiry timestamp; past = reject.

**Access token vs refresh token** — the access token authorizes API calls (short-lived, ~5 min); the refresh token gets a new access token without re-login (longer-lived).

## Authorization models

**RBAC (Role-Based Access Control)** — permissions attached to named roles ("admin", "editor"); users get roles. Simple but rigid; struggles with per-resource and derived permissions.

**ReBAC (Relationship-Based Access Control)** — permissions derived from a graph of *relationships* between users and objects. "Can edit task" is computed by traversing relationships, not by checking a role flag. The model behind this project.

**Zanzibar** — Google's globally-distributed authorization system; the design OpenFGA implements. Source of the tuple + "userset rewrite" ideas.

## OpenFGA terms

**Store** — an isolated container for one authorization model + its tuples. DevBoard uses one store.

**Authorization model** — the typed schema (`model.fga`) defining types (`user`, `org`, `project`, `task`) and their relations. Versioned; each write produces a new `authorization_model_id`.

**Type** — a kind of object: `user`, `org`, `project`, `task`.

**Relation** — a named edge on a type: `admin`, `member`, `owner`, `editor`, `viewer`, `can_edit`, `can_view`, `org`, `project`.

**Relationship tuple** — a stored fact: `(user, relation, object)`, e.g. `(user:alice, owner, project:42)`. The data OpenFGA reasons over.

**`X from Y`** — userset traversal: "find the object my `Y` relation points to, then check `X` on *that* object." E.g. `editor from project` = "editor on the project this task points to."

**`check()`** — the core query: "does (user, relation, object) hold?" Returns a bool after graph traversal.

**`ListObjects()`** — "which objects of type T does this user have relation R on?" Used for list endpoints.

**`write()` / tuple write** — adding or deleting tuples. How role assignments are recorded.

**Playground** — OpenFGA's visual UI (port 3001) for editing tuples and running checks. Great for learning.

## Project / stack terms

**Org / Project / Task** — the domain hierarchy. Org contains projects; projects contain tasks.

**Tenant scoping** — filtering DB queries so users only touch data in their org(s). Defense-in-depth alongside OpenFGA.

**Tuple lifecycle** — the rule that every membership change writes to *both* Postgres (for display) and OpenFGA (for checks). See [03](./03-AUTHORIZATION.md#tuple-lifecycle--who-writes-what-when).

**Outbox pattern** — a reliability technique where writes to two systems are made atomic via a queued "outbox" table. Mentioned as the production-grade fix for Postgres↔OpenFGA sync.

**TanStack Query** — React server-state library; handles fetching, caching, invalidation on the frontend.

**Zustand** — minimal React client-state store; holds UI state (selection, filters).

**next-auth** — Next.js authentication library; here configured with the Keycloak OIDC provider.

**structlog** — structured (key-value/JSON) logging for Python.

**OpenTelemetry (OTEL)** — vendor-neutral tracing/metrics standard; used to trace the request lifecycle.
