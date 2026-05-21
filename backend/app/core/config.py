"""Application configuration loaded from environment variables.

All settings come from a single ``Settings`` object so that the rest of the
codebase never reads ``os.environ`` directly. This keeps configuration
discoverable, typed, and easy to mock in tests.
"""

from functools import lru_cache
from typing import Literal

from pydantic import PostgresDsn, RedisDsn
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # ─── Environment ──────────────────────────────────────────
    environment: Literal["dev", "prod"] = "dev"
    debug: bool = False

    # ─── PostgreSQL ───────────────────────────────────────────
    database_url: PostgresDsn

    # ─── Redis (cache, rate limit, scheduler state) ───────────
    redis_url: RedisDsn

    # ─── Object storage for photos (MinIO local / R2 prod) ────
    s3_endpoint: str
    s3_access_key: str
    s3_secret_key: str
    s3_bucket: str = "malika-perekup"
    s3_region: str = "us-east-1"
    s3_secure: bool = False  # True in prod when endpoint is HTTPS.

    # ─── JWT for API authentication ───────────────────────────
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_ttl_hours: int = 24

    # ─── Telegram ─────────────────────────────────────────────
    bot_token: str
    bot_webapp_url: str  # Public HTTPS URL of the deployed Mini App.

    # ─── Dev-only auth bypass (never enable in prod) ──────────
    dev_auth_bypass: bool = False
    dev_bypass_user_id: str = ""  # kept as str to tolerate empty env value

    @property
    def dev_bypass_user_id_int(self) -> int | None:
        return int(self.dev_bypass_user_id) if self.dev_bypass_user_id.strip() else None

    # ─── Bootstrap admins on first run ────────────────────────
    # Comma-separated Telegram IDs. If ``platform_admins`` table is empty
    # at startup, FastAPI's lifespan creates one row per ID with no
    # password (Telegram-only login). Set this once, then remove the var.
    bootstrap_admin_tg_ids: str = ""

    # Login/password bootstrap — creates a password admin when table is empty.
    # Leave blank to skip. Safe to keep set; ignored after first run.
    bootstrap_admin_login: str = ""
    bootstrap_admin_password: str = ""
    bootstrap_admin_name: str = "Admin"

    # ─── Locale defaults ──────────────────────────────────────
    default_language: Literal["ru", "uz"] = "ru"
    timezone: str = "Asia/Tashkent"

    @property
    def is_prod(self) -> bool:
        return self.environment == "prod"

    @property
    def bootstrap_admin_ids(self) -> list[int]:
        """Parse the comma-separated env value into a list of ints."""
        return [
            int(part.strip())
            for part in self.bootstrap_admin_tg_ids.split(",")
            if part.strip().isdigit()
        ]


@lru_cache
def get_settings() -> Settings:
    """Return the singleton settings instance.

    Cached so that ``.env`` is parsed only once per process.
    """
    return Settings()
