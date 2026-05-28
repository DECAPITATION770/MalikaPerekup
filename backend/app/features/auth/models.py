from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base

# Valid User.role values. Kept as plain strings (not Enum) for migration flexibility.
ROLE_OWNER = "owner"
ROLE_SUPER_ADMIN = "super_admin"


class User(Base):
    """Application user. tenant_id is NULL only for super-admins."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    # tenant_id NULL means platform-level user (super-admin).
    tenant_id: Mapped[int | None] = mapped_column(
        ForeignKey("tenants.id", ondelete="RESTRICT"), index=True
    )
    role: Mapped[str] = mapped_column(
        String(32), default=ROLE_OWNER, server_default=ROLE_OWNER, nullable=False
    )

    # Telegram identity — nullable so users can be invited by @username before first login.
    tg_id: Mapped[int | None] = mapped_column(BigInteger, unique=True, index=True)
    tg_username: Mapped[str | None] = mapped_column(String(64), index=True)
    tg_first_name: Mapped[str | None] = mapped_column(String(128))
    tg_last_name: Mapped[str | None] = mapped_column(String(128))

    language: Mapped[str] = mapped_column(String(8), default="ru", server_default="ru")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
