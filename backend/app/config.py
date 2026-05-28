from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve repo-root .env regardless of cwd (matters for pytest, alembic, scripts).
REPO_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = REPO_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    env: str = "dev"
    tz: str = "Asia/Tashkent"

    database_url: str = "postgresql+asyncpg://malika:malika@localhost:5432/malika"
    redis_url: str = "redis://localhost:6379/0"

    jwt_secret: str = "dev-secret-do-not-use-in-prod"
    jwt_ttl_hours: int = 24

    bot_token: str = ""
    # HTTPS URL where tenant is served — used by bot's WebApp button.
    # Set to ngrok URL when testing locally with Telegram.
    webapp_url: str = ""

    # Comma-separated Telegram user IDs that get super-admin role on login.
    # Super-admins provision tenants via /api/admin/tenants.
    super_admin_tg_ids_raw: str = ""

    s3_endpoint: str = "http://localhost:9000"
    s3_bucket: str = "malika"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_region: str = "us-east-1"

    # Dev-only: skip Telegram initData verification.
    # CRITICAL: app refuses to start in prod if this is true (see app/main.py).
    dev_auth_bypass: bool = False

    @property
    def is_prod(self) -> bool:
        return self.env == "prod"

    @property
    def super_admin_tg_ids(self) -> set[int]:
        if not self.super_admin_tg_ids_raw.strip():
            return set()
        return {int(x.strip()) for x in self.super_admin_tg_ids_raw.split(",") if x.strip()}


settings = Settings()
