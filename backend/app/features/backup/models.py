"""ORM-модели для системы бэкапа (platform-level, без shop_id).

``backup_config`` — синглтон (одна строка, id == 1) с настройками расписания,
ретеншна и доставки в Telegram. ``backup_runs`` — история запусков.

Enum-поля хранятся как строки (тот же приём, что и ``AccessAttempt.source``):
проект не использует native PG ENUM, чтобы миграции оставались простыми и
обратимыми. ``StrEnum`` — это ``str``, поэтому присваивание и сравнения с
колонкой работают прозрачно.
"""

from __future__ import annotations

from datetime import datetime, time
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Integer,
    String,
    Text,
    Time,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class BackupFrequency(StrEnum):
    off = "off"
    daily = "daily"
    interval = "interval"


class TgDeliveryMode(StrEnum):
    full_if_fits = "full_if_fits"
    db_only = "db_only"
    split = "split"


class BackupStatus(StrEnum):
    running = "running"
    ok = "ok"
    failed = "failed"


class BackupTrigger(StrEnum):
    manual = "manual"
    auto = "auto"


class BackupConfig(Base):
    __tablename__ = "backup_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)  # singleton == 1
    enabled: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    frequency: Mapped[str] = mapped_column(
        String(16), default=BackupFrequency.off.value,
        server_default="off", nullable=False,
    )
    daily_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    interval_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    retention_count: Mapped[int] = mapped_column(
        Integer, default=7, server_default="7", nullable=False
    )
    tg_chat_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    tg_auto_send: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    tg_delivery_mode: Mapped[str] = mapped_column(
        String(16), default=TgDeliveryMode.full_if_fits.value,
        server_default="full_if_fits", nullable=False,
    )
    tg_part_size_mb: Mapped[int] = mapped_column(
        Integer, default=49, server_default="49", nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, onupdate=now_utc, nullable=False
    )


class BackupRun(Base):
    __tablename__ = "backup_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
    status: Mapped[str] = mapped_column(String(16), nullable=False)
    """One of ``BackupStatus`` values."""
    trigger: Mapped[str] = mapped_column(String(16), nullable=False)
    """One of ``BackupTrigger`` values."""
    filename: Mapped[str | None] = mapped_column(Text, nullable=True)
    size_bytes: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    object_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    alembic_revision: Mapped[str | None] = mapped_column(Text, nullable=True)
    sent_to_tg: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
