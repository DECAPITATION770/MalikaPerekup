from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class User(Base):
    """Application user. Identity is `id`; Telegram is one (optional) login channel."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Telegram identity — nullable so password-only users are allowed later.
    tg_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    tg_username: Mapped[str | None] = mapped_column(String(64))
    tg_first_name: Mapped[str | None] = mapped_column(String(128))
    tg_last_name: Mapped[str | None] = mapped_column(String(128))

    language: Mapped[str] = mapped_column(String(8), default="ru", server_default="ru")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
