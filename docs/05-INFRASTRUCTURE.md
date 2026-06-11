# 05 — Infrastructure & Local Setup

Everything runs via Docker Compose. This is Day 1.

## Services

| Service | Image | Port (host) | Purpose |
|---|---|---|---|
| postgres | `postgres:16` | 5432 | app data |
| keycloak | `quay.io/keycloak/keycloak:25.0` | 8080 | identity / OIDC |
| openfga | `openfga/openfga:latest` | 8081 (http), 8082 (grpc) | authorization |
| openfga-migrate | `openfga/openfga` | — | one-shot DB migration for OpenFGA |
| redis | `redis:7` | 6379 | authz cache |
| backend | (local build) | 8000 | FastAPI |
| frontend | (local build) | 3000 | Next.js |

> Note: Keycloak and OpenFGA each need a database. Simplest: give each its own database in the **same** Postgres instance (`devboard`, `keycloak`, `openfga`). Create them with an init script.

## docker-compose.yml (skeleton)

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: devboard
    ports: ["5432:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./infra/postgres/init-dbs.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev"]
      interval: 5s
      retries: 10

  keycloak:
    image: quay.io/keycloak/keycloak:25.0
    command: start-dev --import-realm
    environment:
      KC_BOOTSTRAP_ADMIN_USERNAME: admin
      KC_BOOTSTRAP_ADMIN_PASSWORD: admin
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: dev
      KC_DB_PASSWORD: dev
    ports: ["8080:8080"]
    volumes:
      - ./infra/keycloak:/opt/keycloak/data/import
    depends_on:
      postgres: { condition: service_healthy }

  openfga-migrate:
    image: openfga/openfga:latest
    command: migrate
    environment:
      OPENFGA_DATASTORE_ENGINE: postgres
      OPENFGA_DATASTORE_URI: postgres://dev:dev@postgres:5432/openfga?sslmode=disable
    depends_on:
      postgres: { condition: service_healthy }

  openfga:
    image: openfga/openfga:latest
    command: run
    environment:
      OPENFGA_DATASTORE_ENGINE: postgres
      OPENFGA_DATASTORE_URI: postgres://dev:dev@postgres:5432/openfga?sslmode=disable
      OPENFGA_PLAYGROUND_ENABLED: "true"
    ports: ["8081:8080", "8082:8081", "3001:3000"]   # http, grpc, playground
    depends_on:
      openfga-migrate: { condition: service_completed_successfully }

  redis:
    image: redis:7
    ports: ["6379:6379"]

  backend:
    build: ./backend
    env_file: ./backend/.env
    ports: ["8000:8000"]
    depends_on:
      postgres: { condition: service_healthy }
      openfga: { condition: service_started }
      redis: { condition: service_started }

  frontend:
    build: ./frontend
    env_file: ./frontend/.env.local
    ports: ["3000:3000"]
    depends_on: [backend]

volumes:
  pgdata:
```

`infra/postgres/init-dbs.sql`:
```sql
CREATE DATABASE keycloak;
CREATE DATABASE openfga;
-- devboard is created by POSTGRES_DB
```

> Note: Bring services up in stages early on: `docker compose up postgres keycloak openfga redis` first, get those healthy, then run the backend locally (not in compose) with `uvicorn --reload` for fast iteration. Containerize the backend later.

## Keycloak setup

You can click through the admin console (http://localhost:8080, admin/admin) **or** import a realm file. For reproducibility, build the realm by hand once, then **export** it to `infra/keycloak/realm-export.json` so `--import-realm` recreates it.

### What to create

1. **Realm:** `devboard`
2. **Client:** `devboard-app`
   - Client type: **OpenID Connect**
   - **(decision)** For the Next.js app using `next-auth`, use a **confidential** client (Client authentication ON) with a client secret — next-auth runs the token exchange server-side. (A public client + PKCE works for pure SPA `keycloak-js`; next-auth's standard flow wants the secret.)
   - Valid redirect URIs: `http://localhost:3000/api/auth/callback/keycloak`
   - Web origins: `http://localhost:3000`
   - Standard flow (authorization code) enabled.
3. **Test users:** create at least 4 (`alice`, `bob`, `carol`, `dave`) with passwords, so you can test the authz matrix in [03](./03-AUTHORIZATION.md#test-cases). Set passwords as non-temporary.

### Token facts the backend needs

- **Issuer:** `http://localhost:8080/realms/devboard`
- **JWKS:** `http://localhost:8080/realms/devboard/protocol/openid-connect/certs`
- **Audience:** by default Keycloak's `aud` may be `account`; either configure an audience mapper to add `devboard-app`, or relax `aud` verification in dev. **(decision)** Add an audience mapper — verifying `aud` properly is part of the learning.

> Note: Issuer mismatch is the #1 Day-1 gotcha. If the backend runs in Docker, `localhost:8080` inside the container is **not** the host Keycloak. Either run the backend on the host during dev, or set the issuer to `http://keycloak:8080/...` and make sure the frontend/browser and backend agree on the issuer string — the `iss` claim must match exactly what the backend expects. Easiest dev path: run backend on host, talk to `localhost:8080`.

## OpenFGA bootstrap

After `openfga` is up:

```bash
# install CLI: https://github.com/openfga/cli  (brew install openfga/tap/fga)
export FGA_API_URL=http://localhost:8081

fga store create --name devboard
# → returns { "id": "01J...", ... }   save as OPENFGA_STORE_ID

fga model write --store-id <STORE_ID> --file infra/openfga/model.fga
# → returns authorization_model_id   save as OPENFGA_MODEL_ID
```

Put a script at `infra/openfga/bootstrap.sh` that does both and prints the two ids. Re-running creates a new store; for dev just keep the ids in `.env`.

The OpenFGA **Playground** at http://localhost:3001 lets you write tuples and run checks visually — invaluable for understanding Day 3.

## Backend `.env`

```
DATABASE_URL=postgresql+asyncpg://dev:dev@localhost:5432/devboard
KEYCLOAK_ISSUER=http://localhost:8080/realms/devboard
KEYCLOAK_JWKS_URL=http://localhost:8080/realms/devboard/protocol/openid-connect/certs
KEYCLOAK_AUDIENCE=devboard-app
OPENFGA_API_URL=http://localhost:8081
OPENFGA_STORE_ID=01J...
OPENFGA_MODEL_ID=01J...
REDIS_URL=redis://localhost:6379/0
```

## Frontend `.env.local`

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
KEYCLOAK_CLIENT_ID=devboard-app
KEYCLOAK_CLIENT_SECRET=<from keycloak client credentials tab>
KEYCLOAK_ISSUER=http://localhost:8080/realms/devboard
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Day-1 smoke test (the gate to Day 2)

1. `docker compose up` → all services healthy.
2. Keycloak admin console reachable, `devboard` realm + `devboard-app` client + test users exist.
3. Get a token via direct grant (for curl testing):
   ```bash
   curl -s -X POST http://localhost:8080/realms/devboard/protocol/openid-connect/token \
     -d grant_type=password -d client_id=devboard-app \
     -d client_secret=<secret> -d username=alice -d password=alice | jq -r .access_token
   ```
4. `curl -H "Authorization: Bearer <token>" http://localhost:8000/me` → **200** with alice's info.
5. Same call with no token → **401**. With a garbage token → **401**.

If all five pass, Day 1 is done.
