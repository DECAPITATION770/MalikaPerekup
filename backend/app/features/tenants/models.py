from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Tenant(Base):
    """A merchant account. Each Tenant has exactly one owner User (role='owner').

    Super-admin (role='super_admin', tenant_id=NULL) is NOT a tenant — it's a platform role.
    """

    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true", nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
