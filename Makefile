.PHONY: up down bootstrap migrate backend frontend test logs clean

# Bring up all infrastructure (postgres, redis, keycloak, openfga + migrate).
up:
	docker compose up -d postgres redis keycloak openfga

down:
	docker compose down

# Initialize the OpenFGA store + model; writes store/model ids into .env.
bootstrap:
	bash infra/openfga/bootstrap.sh

# Apply database migrations.
migrate:
	cd backend && . .venv/bin/activate && alembic upgrade head

# Run the backend API (http://localhost:8000).
backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --port 8000 --reload

# Run the frontend (http://localhost:3001).
frontend:
	cd frontend && npm run dev

# Run the backend test suite (needs postgres + redis + openfga up).
test:
	cd backend && . .venv/bin/activate && pytest -q

logs:
	docker compose logs -f

# Stop containers and remove volumes (wipes all data).
clean:
	docker compose down -v
