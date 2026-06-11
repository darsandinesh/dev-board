from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo-root .env, resolved absolutely so it loads regardless of the cwd the
# process is launched from (backend/ for uvicorn, backend/ for alembic, etc.).
# Real environment variables (e.g. set by docker-compose) still take priority.
_ENV_FILE = Path(__file__).resolve().parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://devboard:devboard@localhost:5432/devboard"

    # Redis
    redis_url: str = "redis://localhost:6379"

    # Keycloak
    keycloak_url: str = "http://localhost:8080"
    keycloak_realm: str = "devboard"
    keycloak_client_id: str = "devboard-app"

    # OpenFGA
    openfga_api_url: str = "http://localhost:8082"
    openfga_store_id: str = ""
    openfga_model_id: str = ""

    # App
    app_name: str = "DevBoard"
    debug: bool = True

    @property
    def keycloak_issuer(self) -> str:
        return f"{self.keycloak_url}/realms/{self.keycloak_realm}"

    @property
    def keycloak_jwks_uri(self) -> str:
        return f"{self.keycloak_issuer}/protocol/openid-connect/certs"


settings = Settings()
