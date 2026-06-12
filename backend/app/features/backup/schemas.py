from __future__ import annotations

from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field

from app.features.backup.models import (
    BackupFrequency,
    BackupStatus,
    BackupTrigger,
    TgDeliveryMode,
)


class ConfigIn(BaseModel):
    enabled: bool
    frequency: BackupFrequency
    daily_time: time | None = None
    interval_hours: int | None = Field(default=None, ge=1, le=168)
    retention_count: int = Field(ge=1, le=100)
    tg_chat_id: int | None = None
    tg_auto_send: bool = False
    tg_delivery_mode: TgDeliveryMode = TgDeliveryMode.full_if_fits
    tg_part_size_mb: int = Field(default=49, ge=1, le=49)


class ConfigOut(ConfigIn):
    model_config = ConfigDict(from_attributes=True)
    updated_at: datetime


class RunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    created_at: datetime
    status: BackupStatus
    trigger: BackupTrigger
    filename: str | None
    size_bytes: int | None
    object_count: int | None
    sent_to_tg: bool
    error: str | None
