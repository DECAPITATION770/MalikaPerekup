from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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


settings = Settings()
