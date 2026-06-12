"""Request and response shapes for ``/admin/*`` endpoints."""

from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.features.auth.schemas import TokenResponse  # re-used as is

# ─── Auth ──────────────────────────────────────────────────────────────


class AdminTelegramAuth(BaseModel):
    init_data: str = Field(min_length=1)


class AdminLoginRequest(BaseModel):
    login: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)


class AdminTokenResponse(TokenResponse):
    """Same JWT envelope as user auth, just with ``is_admin=true`` claim."""

    is_admin: Literal[True] = True


class AdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tg_id: int | None
    tg_username: str | None
    login: str | None
    full_name: str
    is_active: bool
    last_login_at: datetime | None
    created_at: datetime


# ─── Shop management ───────────────────────────────────────────────────


class CreateShopRequest(BaseModel):
    """Admin registers a new shop along with its owner.

    At least one of ``owner_tg_id`` / ``owner_login`` must be provided so
    the perekupchik has *some* way to authenticate. Password is hashed
    server-side; if omitted, the owner can only sign in via Telegram.
    """

    name: str = Field(min_length=2, max_length=120)
    language_default: Literal["ru", "uz"] = "ru"
    owner_tg_id: int | None = None
    owner_tg_username: str | None = Field(default=None, max_length=64)
    owner_full_name: str = Field(min_length=1, max_length=120)
    owner_phone: str | None = Field(default=None, max_length=32)
    owner_login: str | None = Field(default=None, min_length=3, max_length=64,
                                    pattern=r"^[a-zA-Z0-9_.-]+$")
    owner_password: str | None = Field(default=None, min_length=8, max_length=128)


class ShopAdminUpdate(BaseModel):
    """PATCH /admin/shops/{id} — change plan / extend trial."""

    plan: Literal["trial", "basic", "business"] | None = None
    plan_until: date | None = None


class FreezeRequest(BaseModel):
    reason: str | None = None


class CredentialsRequest(BaseModel):
    """Set or rotate the owner's login + password.

    Either field can be omitted to keep the existing value.
    """

    login: str | None = Field(default=None, min_length=3, max_length=64,
                              pattern=r"^[a-zA-Z0-9_.-]+$")
    password: str | None = Field(default=None, min_length=8, max_length=128)


class OwnerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tg_id: int | None
    tg_username: str | None
    full_name: str
    phone: str | None
    login: str | None
    has_password: bool
    last_login_at: datetime | None
    last_login_source: str | None
    created_at: datetime
    is_blocked: bool
    blocked_at: datetime | None


class ShopAdminOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    language_default: Literal["ru", "uz"]
    plan: str
    plan_until: date | None
    is_frozen: bool
    frozen_at: datetime | None
    frozen_reason: str | None
    created_at: datetime

    owner: OwnerOut


class ShopStats(BaseModel):
    devices_in_stock: int
    inventory_value_uzs: Decimal
    sales_total_uzs: Decimal
    profit_total_uzs: Decimal
    nasiya_active_plans: int
    nasiya_debt_uzs: Decimal


class ShopAdminDetail(ShopAdminOut):
    stats: ShopStats


# ─── Access attempts ───────────────────────────────────────────────────


class AccessAttemptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    attempted_at: datetime
    source: str
    identifier: str
    tg_username: str | None
    ip_address: str | None
    success: bool
    reason: str | None
    user_id: int | None


# ─── Nasiya overview ───────────────────────────────────────────────────


class NasiyaOverdueRow(BaseModel):
    shop_id: int
    shop_name: str
    plan_id: int
    payment_id: int
    buyer_name: str
    buyer_phone: str | None
    device: str
    due_date: date
    days_overdue: int
    amount_due: Decimal
    remaining: Decimal


class NasiyaActiveRow(BaseModel):
    shop_id: int
    shop_name: str
    plan_id: int
    buyer_name: str
    buyer_phone: str | None
    device: str
    next_due_date: date | None
    remaining: Decimal


# ─── Platform stats ────────────────────────────────────────────────────


class PlatformStats(BaseModel):
    shops_total: int
    shops_active: int
    shops_frozen: int
    shops_trial: int
    shops_paid: int

    users_total: int

    nasiya_active_count: int
    nasiya_overdue_count: int
    nasiya_total_debt_uzs: Decimal

    failed_attempts_today: int
