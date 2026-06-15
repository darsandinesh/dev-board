# DevBoard on Kubernetes (Helm)

An **umbrella Helm chart** that deploys the whole DevBoard stack — frontend,
backend, Keycloak, OpenFGA, Postgres, Redis — with one command. Every service is
a **local subchart** under [`devboard/charts/`](./devboard/charts), so you can
read each manifest and learn how the pieces fit together.

```
devboard/
├── Chart.yaml              # umbrella; lists subchart deps + enable conditions
├── values.yaml             # global config + per-subchart overrides
├── templates/
│   ├── _helpers.tpl        # shared labels + secret-name helper
│   ├── secret.yaml         # ONE Secret (db pw, keycloak client, nextauth)
│   ├── ingress.yaml        # "/" → frontend, "/api" → backend
│   └── NOTES.txt           # post-install instructions
└── charts/
    ├── postgres/   Deployment + PVC + Service + init-SQL ConfigMap
    ├── redis/      Deployment + Service
    ├── keycloak/   Deployment + Service (start-dev, Postgres-backed)
    ├── openfga/    Deployment + Service + pre-install migrate Job (hook)
    ├── backend/    Deployment + Service + ConfigMap + Alembic migrate Job (hook)
    └── frontend/   Deployment + Service
```

## Concepts this chart demonstrates

| Helm concept | Where to look |
|---|---|
| Umbrella + subcharts | `Chart.yaml` `dependencies:` + `charts/` |
| `global.*` values shared across subcharts | `values.yaml` `global:`, used in every subchart |
| Conditional subcharts (`postgres.enabled`) | `Chart.yaml` `condition:` — disable to use a managed DB |
| One Secret consumed by many pods | `templates/secret.yaml` + `secretKeyRef` everywhere |
| Secret → URL without leaking it | `charts/backend/_helpers.tpl` (`$(POSTGRES_PASSWORD)` expansion) |
| Named-template helpers reused across files | `backend.dbEnv` in Deployment **and** migrate Job |
| Install/upgrade hooks + ordering | `*/migrate-job.yaml` (`helm.sh/hook`, `hook-weight`) |

## Prerequisites

- A cluster: [kind](https://kind.sigs.k8s.io/), [minikube](https://minikube.sigs.k8s.io/), or k3d.
- `kubectl` + `helm` v3.
- An ingress controller for hostname access (e.g. `ingress-nginx`), or just use
  `kubectl port-forward`.

## 1. Build the app images

The chart runs your own backend/frontend images (everything else is upstream).
Build them and load them into the cluster (kind shown):

```bash
# from repo root
docker build -t devboard-backend:latest  ./backend
docker build -t devboard-frontend:latest \
  --build-arg NEXT_PUBLIC_API_URL=http://devboard.local/api \
  --build-arg NEXT_PUBLIC_KEYCLOAK_ISSUER=http://devboard.local/realms/devboard \
  ./frontend

kind load docker-image devboard-backend:latest devboard-frontend:latest
# minikube: `minikube image load devboard-backend:latest` (and frontend)
```

> `NEXT_PUBLIC_*` are **build-time** values inlined into the browser bundle, so
> they're passed as `--build-arg`, not Helm values.

## 2. Install

```bash
helm install dev deploy/helm/devboard \
  --namespace devboard --create-namespace \
  --set secrets.nextauthSecret="$(openssl rand -base64 32)"
```

Watch it converge — note the hook order: OpenFGA's schema migrate (pre-install)
→ services start → backend's Alembic migrate (post-install):

```bash
kubectl get pods -n devboard -w
kubectl logs -n devboard job/dev-backend-migrate
```

## 3. Bootstrap the OpenFGA store + model

OpenFGA needs DevBoard's authorization model loaded once, then the backend needs
the resulting store/model ids:

```bash
kubectl port-forward -n devboard svc/dev-openfga 8082:8082 &
FGA_API_URL=http://localhost:8082 bash infra/openfga/bootstrap.sh   # prints ids

helm upgrade dev deploy/helm/devboard --namespace devboard \
  --reuse-values \
  --set backend.openfga.storeId=<STORE_ID> \
  --set backend.openfga.modelId=<MODEL_ID>
```

## 4. Reach it

```bash
# with ingress-nginx + an /etc/hosts entry for devboard.local:
open http://devboard.local

# or without ingress:
kubectl port-forward -n devboard svc/dev-frontend 3001:3000
```

## Production notes (intentionally simplified here)

This chart favors **readability for learning** over production hardening. For a
real deployment you'd:

- Replace the single-replica `postgres`/`redis` Deployments with the **Bitnami
  subcharts** or a managed service (set `postgres.enabled=false` and point the
  hosts at your DB). The `condition:` fields already support this.
- Run Keycloak with `start` (not `start-dev`) behind TLS on its **own hostname**
  — browser OIDC redirects need a public issuer URL, which is why `KEYCLOAK_ISSUER`
  here is split between an in-cluster value (server token exchange) and the public
  host (browser). Expose Keycloak via its own Ingress in production.
- Add resource requests/limits, PodDisruptionBudgets, NetworkPolicies, and move
  secrets to an external manager (Sealed Secrets / External Secrets / Vault).
