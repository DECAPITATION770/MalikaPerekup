"""HTTP endpoints for the platform admin panel.

Every endpoint depends on ``CurrentAdmin`` (except the two login routes),
which validates the JWT carries ``is_admin = true`` and resolves an
active row from ``platform_admins``.
"""

from datetime import date
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import today_tashkent
from app.common.pagination import Page, PageParams
from app.common.ratelimit import enforce_account_limit, login_rate_limit
from app.core.deps import DbSession
from app.features.admin import repository as admin_repo
from app.features.admin import service
from app.features.admin.auth import CurrentAdmin
from app.features.admin.models import AccessAttempt
from app.features.admin.schemas import (
    AccessAttemptOut,
    AdminLoginRequest,
    AdminOut,
    AdminTelegramAuth,
    AdminTokenResponse,
    CreateShopRequest,
    CredentialsRequest,
    FreezeRequest,
    NasiyaActiveRow,
    NasiyaOverdueRow,
    OwnerOut,
    PlatformStats,
    ShopAdminDetail,
    ShopAdminOut,
    ShopAdminUpdate,
    ShopStats,
)
from app.features.auth import repository as user_repo
from app.features.auth.models import User
from app.features.devices.models import Device, DeviceStatus
from app.features.installments.models import (
    InstallmentPayment,
    InstallmentPlan,
    PaymentStatus,
    PlanStatus,
)
from app.features.purchases.models import Purchase
from app.features.sales.models import Sale, SaleStatus
from app.features.shops import repository as shop_repo
from app.features.shops.models import Shop

router = APIRouter(prefix="/admin", tags=["admin"])


def _admin_out(admin) -> AdminOut:
    return AdminOut.model_validate(admin)


def _owner_out(user: User) -> OwnerOut:
    return OwnerOut.model_validate(
        {
            "id": user.id,
            "tg_id": user.tg_id,
            "tg_username": user.tg_username,
            "full_name": user.full_name,
            "phone": user.phone,
            "login": user.login,
            "has_password": user.password_hash is not None,
            "last_login_at": user.last_login_at,
            "last_login_source": user.last_login_source,
            "created_at": user.created_at,
            "is_blocked": user.is_blocked,
            "blocked_at": user.blocked_at,
        }
    )


async def _shop_admin_out(db: AsyncSession, shop: Shop) -> ShopAdminOut:
    owner = await user_repo.get_by_id(db, shop.owner_id)
    return ShopAdminOut(
        id=shop.id,
        name=shop.name,
        language_default=shop.language_default,  # type: ignore[arg-type]
        plan=shop.plan,
        plan_until=shop.plan_until,
        is_frozen=shop.is_frozen,
        frozen_at=shop.frozen_at,
        frozen_reason=shop.frozen_reason,
        created_at=shop.created_at,
        owner=_owner_out(owner),  # type: ignore[arg-type]
    )


# ─── Auth ──────────────────────────────────────────────────────────────


_admin_login_throttle = login_rate_limit(
    "admin.login", per_ip_limit=5, per_ip_window=60
)
_admin_tg_throttle = login_rate_limit(
    "admin.telegram", per_ip_limit=15, per_ip_window=60
)


@router.post(
    "/auth/telegram",
    response_model=AdminTokenResponse,
    dependencies=[Depends(_admin_tg_throttle)],
)
async def login_via_telegram(
    payload: AdminTelegramAuth, db: DbSession
) -> AdminTokenResponse:
    try:
        admin, token = await service.login_admin_via_telegram(
            db, payload.init_data
        )
    except service.AdminAuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    return AdminTokenResponse(access_token=token, user_id=admin.id)


@router.post(
    "/auth/login",
    response_model=AdminTokenResponse,
    dependencies=[Depends(_admin_login_throttle)],
)
async def login_via_password(
    payload: AdminLoginRequest, db: DbSession
) -> AdminTokenResponse:
    # Per-account window on top of the per-IP dependency. Admin is the
    # highest-value account on the platform, so it's tighter than tenant
    # login: 5 tries per login per 15 min.
    await enforce_account_limit(
        "admin.login.acct", payload.login, limit=5, window_seconds=900
    )
    try:
        admin, token = await service.login_admin_via_password(
            db, payload.login, payload.password
        )
    except service.AdminAuthError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc
    return AdminTokenResponse(access_token=token, user_id=admin.id)


@router.get("/me", response_model=AdminOut)
async def me(admin: CurrentAdmin) -> AdminOut:
    return _admin_out(admin)


# ─── Shop CRUD ─────────────────────────────────────────────────────────


@router.get("/shops", response_model=Page[ShopAdminOut])
async def list_shops(
    admin: CurrentAdmin,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    q: Annotated[str | None, Query(description="search by name / phone / login")] = None,
    plan: Annotated[str | None, Query()] = None,
    frozen: Annotated[bool | None, Query()] = None,
) -> Page[ShopAdminOut]:
    base = select(Shop, User).join(User, User.id == Shop.owner_id)
    if plan:
        base = base.where(Shop.plan == plan)
    if frozen is not None:
        base = base.where(Shop.is_frozen == frozen)
    if q:
        like = f"%{q}%"
        base = base.where(
            or_(
                Shop.name.ilike(like),
                User.full_name.ilike(like),
                User.phone.ilike(like),
                User.login.ilike(like),
                User.tg_username.ilike(like),
            )
        )

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            base.order_by(Shop.created_at.desc())
            .limit(params.limit)
            .offset(params.offset)
        )
    ).all()

    items = [
        ShopAdminOut(
            id=shop.id,
            name=shop.name,
            language_default=shop.language_default,  # type: ignore[arg-type]
            plan=shop.plan,
            plan_until=shop.plan_until,
            is_frozen=shop.is_frozen,
            frozen_at=shop.frozen_at,
            frozen_reason=shop.frozen_reason,
            created_at=shop.created_at,
            owner=_owner_out(owner),
        )
        for shop, owner in rows
    ]
    return Page.of(items=items, total=int(total), params=params)


@router.post(
    "/shops", response_model=ShopAdminOut, status_code=status.HTTP_201_CREATED
)
async def create_shop(
    payload: CreateShopRequest, admin: CurrentAdmin, db: DbSession
) -> ShopAdminOut:
    try:
        shop, _ = await service.register_shop_with_owner(
            db,
            name=payload.name,
            language_default=payload.language_default,
            owner_full_name=payload.owner_full_name,
            owner_tg_id=payload.owner_tg_id,
            owner_tg_username=payload.owner_tg_username,
            owner_phone=payload.owner_phone,
            owner_login=payload.owner_login,
            owner_password=payload.owner_password,
        )
    except service.ShopRegistrationError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return await _shop_admin_out(db, shop)


@router.get("/shops/{shop_id}", response_model=ShopAdminDetail)
async def get_shop(
    shop_id: int, admin: CurrentAdmin, db: DbSession
) -> ShopAdminDetail:
    shop = await shop_repo.get_by_id(db, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "shop not found")
    base = await _shop_admin_out(db, shop)
    stats = await _build_shop_stats(db, shop_id=shop.id)
    return ShopAdminDetail(**base.model_dump(), stats=stats)


@router.patch("/shops/{shop_id}", response_model=ShopAdminOut)
async def update_shop(
    shop_id: int,
    payload: ShopAdminUpdate,
    admin: CurrentAdmin,
    db: DbSession,
) -> ShopAdminOut:
    shop = await shop_repo.get_by_id(db, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "shop not found")
    await service.update_shop_admin_fields(
        shop, plan=payload.plan, plan_until=payload.plan_until
    )
    return await _shop_admin_out(db, shop)


@router.post("/shops/{shop_id}/freeze", response_model=ShopAdminOut)
async def freeze_shop(
    shop_id: int,
    payload: FreezeRequest,
    admin: CurrentAdmin,
    db: DbSession,
) -> ShopAdminOut:
    shop = await shop_repo.get_by_id(db, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "shop not found")
    await service.freeze_shop(shop, reason=payload.reason)
    return await _shop_admin_out(db, shop)


@router.post("/shops/{shop_id}/unfreeze", response_model=ShopAdminOut)
async def unfreeze_shop(
    shop_id: int, admin: CurrentAdmin, db: DbSession
) -> ShopAdminOut:
    shop = await shop_repo.get_by_id(db, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "shop not found")
    await service.unfreeze_shop(shop)
    return await _shop_admin_out(db, shop)


@router.post("/users/{user_id}/block", response_model=OwnerOut)
async def block_user(user_id: int, admin: CurrentAdmin, db: DbSession) -> OwnerOut:
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    await service.block_user(user)
    return _owner_out(user)


@router.post("/users/{user_id}/unblock", response_model=OwnerOut)
async def unblock_user(user_id: int, admin: CurrentAdmin, db: DbSession) -> OwnerOut:
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    await service.unblock_user(user)
    return _owner_out(user)


@router.post("/shops/{shop_id}/owner/credentials", response_model=OwnerOut)
async def set_owner_credentials(
    shop_id: int,
    payload: CredentialsRequest,
    admin: CurrentAdmin,
    db: DbSession,
) -> OwnerOut:
    shop = await shop_repo.get_by_id(db, shop_id)
    if shop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "shop not found")
    owner = await user_repo.get_by_id(db, shop.owner_id)
    if owner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "owner not found")
    try:
        await service.set_owner_credentials(
            db, owner, login=payload.login, password=payload.password
        )
    except service.ShopRegistrationError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return _owner_out(owner)


# ─── Users ─────────────────────────────────────────────────────────────


@router.get("/users", response_model=Page[OwnerOut])
async def list_users(
    admin: CurrentAdmin,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    q: Annotated[str | None, Query()] = None,
) -> Page[OwnerOut]:
    base = select(User)
    if q:
        like = f"%{q}%"
        base = base.where(
            or_(
                User.full_name.ilike(like),
                User.phone.ilike(like),
                User.login.ilike(like),
                User.tg_username.ilike(like),
            )
        )
    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    items = (
        await db.execute(
            base.order_by(User.created_at.desc())
            .limit(params.limit)
            .offset(params.offset)
        )
    ).scalars().all()
    return Page.of(
        items=[_owner_out(u) for u in items],
        total=int(total),
        params=params,
    )


@router.get("/users/{user_id}", response_model=OwnerOut)
async def get_user(
    user_id: int, admin: CurrentAdmin, db: DbSession
) -> OwnerOut:
    user = await user_repo.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "user not found")
    return _owner_out(user)


# ─── Access attempts ───────────────────────────────────────────────────


@router.get("/access-attempts", response_model=Page[AccessAttemptOut])
async def list_access_attempts(
    admin: CurrentAdmin,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    source: Annotated[str | None, Query()] = None,
    success: Annotated[bool | None, Query()] = None,
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
) -> Page[AccessAttemptOut]:
    items, total = await admin_repo.search_attempts(
        db,
        source=source,
        success=success,
        date_from=date_from,
        date_to=date_to,
        limit=params.limit,
        offset=params.offset,
    )
    return Page.of(
        items=[AccessAttemptOut.model_validate(a) for a in items],
        total=total,
        params=params,
    )


# ─── Nasiya overview across all shops ──────────────────────────────────


@router.get("/nasiya/overdue", response_model=list[NasiyaOverdueRow])
async def nasiya_overdue(
    admin: CurrentAdmin, db: DbSession
) -> list[NasiyaOverdueRow]:
    today = today_tashkent()
    rows = (
        await db.execute(
            select(
                Shop.id.label("shop_id"),
                Shop.name.label("shop_name"),
                InstallmentPlan.id.label("plan_id"),
                InstallmentPayment.id.label("payment_id"),
                Sale.buyer_name,
                Sale.buyer_phone,
                Device.brand,
                Device.model,
                InstallmentPayment.due_date,
                InstallmentPayment.amount_due,
                InstallmentPayment.amount_paid,
                InstallmentPlan.total_amount,
            )
            .select_from(InstallmentPayment)
            .join(InstallmentPlan, InstallmentPlan.id == InstallmentPayment.plan_id)
            .join(Sale, Sale.id == InstallmentPlan.sale_id)
            .join(Device, Device.id == Sale.device_id)
            .join(Shop, Shop.id == InstallmentPlan.shop_id)
            .where(
                InstallmentPayment.due_date < today,
                InstallmentPayment.status.in_(
                    (
                        PaymentStatus.PENDING.value,
                        PaymentStatus.PARTIAL.value,
                        PaymentStatus.OVERDUE.value,
                    )
                ),
            )
            .order_by(InstallmentPayment.due_date.asc())
        )
    ).all()

    # Compute remaining balance per plan in one SQL pass.
    remaining_by_plan = dict(
        (
            await db.execute(
                select(
                    InstallmentPayment.plan_id,
                    func.sum(InstallmentPayment.amount_paid),
                ).group_by(InstallmentPayment.plan_id)
            )
        ).all()
    )

    result = []
    for row in rows:
        paid_total = remaining_by_plan.get(row.plan_id, Decimal("0")) or Decimal("0")
        remaining = row.total_amount - paid_total
        result.append(
            NasiyaOverdueRow(
                shop_id=row.shop_id,
                shop_name=row.shop_name,
                plan_id=row.plan_id,
                payment_id=row.payment_id,
                buyer_name=row.buyer_name,
                buyer_phone=row.buyer_phone,
                device=f"{row.brand} {row.model}",
                due_date=row.due_date,
                days_overdue=(today - row.due_date).days,
                amount_due=row.amount_due - row.amount_paid,
                remaining=remaining,
            )
        )
    return result


@router.get("/nasiya/active", response_model=list[NasiyaActiveRow])
async def nasiya_active(
    admin: CurrentAdmin, db: DbSession
) -> list[NasiyaActiveRow]:
    plans_q = (
        select(
            Shop.id.label("shop_id"),
            Shop.name.label("shop_name"),
            InstallmentPlan.id.label("plan_id"),
            InstallmentPlan.total_amount,
            Sale.buyer_name,
            Sale.buyer_phone,
            Device.brand,
            Device.model,
        )
        .select_from(InstallmentPlan)
        .join(Sale, Sale.id == InstallmentPlan.sale_id)
        .join(Device, Device.id == Sale.device_id)
        .join(Shop, Shop.id == InstallmentPlan.shop_id)
        .where(
            InstallmentPlan.status.in_(
                (PlanStatus.ACTIVE.value, PlanStatus.OVERDUE.value)
            ),
        )
    )
    rows = (await db.execute(plans_q)).all()

    next_due_q = (
        select(
            InstallmentPayment.plan_id,
            func.min(InstallmentPayment.due_date),
        )
        .where(
            InstallmentPayment.status.in_(
                (PaymentStatus.PENDING.value, PaymentStatus.PARTIAL.value, PaymentStatus.OVERDUE.value)
            ),
        )
        .group_by(InstallmentPayment.plan_id)
    )
    next_due_by_plan = dict((await db.execute(next_due_q)).all())

    paid_q = (
        select(
            InstallmentPayment.plan_id,
            func.sum(InstallmentPayment.amount_paid),
        ).group_by(InstallmentPayment.plan_id)
    )
    paid_by_plan = dict((await db.execute(paid_q)).all())

    result = []
    for row in rows:
        paid = paid_by_plan.get(row.plan_id, Decimal("0")) or Decimal("0")
        result.append(
            NasiyaActiveRow(
                shop_id=row.shop_id,
                shop_name=row.shop_name,
                plan_id=row.plan_id,
                buyer_name=row.buyer_name,
                buyer_phone=row.buyer_phone,
                device=f"{row.brand} {row.model}",
                next_due_date=next_due_by_plan.get(row.plan_id),
                remaining=row.total_amount - paid,
            )
        )
    return result


# ─── Stats ─────────────────────────────────────────────────────────────


async def _build_shop_stats(db: AsyncSession, *, shop_id: int) -> ShopStats:
    inv = (
        await db.execute(
            select(
                func.count(Device.id),
                func.coalesce(func.sum(Purchase.price_uzs), 0),
            )
            .select_from(Device)
            .join(Purchase, Purchase.device_id == Device.id)
            .where(
                Device.shop_id == shop_id,
                Device.status == DeviceStatus.IN_STOCK.value,
            )
        )
    ).one()

    sales_agg = (
        await db.execute(
            select(
                func.coalesce(func.sum(Sale.sale_price_uzs), 0),
                func.coalesce(func.sum(Sale.profit_uzs), 0),
            ).where(
                Sale.shop_id == shop_id,
                Sale.status == SaleStatus.ACTIVE.value,
            )
        )
    ).one()

    plans_agg = (
        await db.execute(
            select(
                func.count(InstallmentPlan.id),
                func.coalesce(
                    func.sum(InstallmentPlan.total_amount)
                    - func.sum(InstallmentPayment.amount_paid),
                    0,
                ),
            )
            .select_from(InstallmentPlan)
            .outerjoin(
                InstallmentPayment,
                InstallmentPayment.plan_id == InstallmentPlan.id,
            )
            .where(
                InstallmentPlan.shop_id == shop_id,
                InstallmentPlan.status.in_(
                    (PlanStatus.ACTIVE.value, PlanStatus.OVERDUE.value)
                ),
            )
        )
    ).one()

    return ShopStats(
        devices_in_stock=int(inv[0]),
        inventory_value_uzs=Decimal(inv[1] or 0),
        sales_total_uzs=Decimal(sales_agg[0] or 0),
        profit_total_uzs=Decimal(sales_agg[1] or 0),
        nasiya_active_plans=int(plans_agg[0]),
        nasiya_debt_uzs=Decimal(plans_agg[1] or 0),
    )


@router.get("/stats", response_model=PlatformStats)
async def platform_stats(admin: CurrentAdmin, db: DbSession) -> PlatformStats:
    today = today_tashkent()

    shops_breakdown = (
        await db.execute(
            select(
                func.count(Shop.id),
                func.sum(case((Shop.is_frozen == False, 1), else_=0)),  # noqa: E712
                func.sum(case((Shop.is_frozen == True, 1), else_=0)),   # noqa: E712
                func.sum(case((Shop.plan == "trial", 1), else_=0)),
                func.sum(case((Shop.plan != "trial", 1), else_=0)),
            )
        )
    ).one()

    users_total = (await db.execute(select(func.count(User.id)))).scalar_one()

    plans_active = (
        await db.execute(
            select(func.count(InstallmentPlan.id)).where(
                InstallmentPlan.status.in_(
                    (PlanStatus.ACTIVE.value, PlanStatus.OVERDUE.value)
                )
            )
        )
    ).scalar_one()

    overdue_count = (
        await db.execute(
            select(func.count(InstallmentPayment.id)).where(
                InstallmentPayment.due_date < today,
                InstallmentPayment.status.in_(
                    (
                        PaymentStatus.PENDING.value,
                        PaymentStatus.PARTIAL.value,
                        PaymentStatus.OVERDUE.value,
                    )
                ),
            )
        )
    ).scalar_one()

    total_debt = (
        await db.execute(
            select(
                func.coalesce(
                    func.sum(InstallmentPlan.total_amount)
                    - func.sum(InstallmentPayment.amount_paid),
                    0,
                )
            )
            .select_from(InstallmentPlan)
            .outerjoin(
                InstallmentPayment,
                InstallmentPayment.plan_id == InstallmentPlan.id,
            )
            .where(
                InstallmentPlan.status.in_(
                    (PlanStatus.ACTIVE.value, PlanStatus.OVERDUE.value)
                )
            )
        )
    ).scalar_one()

    failed_today = (
        await db.execute(
            select(func.count())
            .select_from(AccessAttempt)
            .where(
                AccessAttempt.success == False,  # noqa: E712
                func.date(AccessAttempt.attempted_at) == today,
            )
        )
    ).scalar_one()

    return PlatformStats(
        shops_total=int(shops_breakdown[0]),
        shops_active=int(shops_breakdown[1] or 0),
        shops_frozen=int(shops_breakdown[2] or 0),
        shops_trial=int(shops_breakdown[3] or 0),
        shops_paid=int(shops_breakdown[4] or 0),
        users_total=int(users_total),
        nasiya_active_count=int(plans_active),
        nasiya_overdue_count=int(overdue_count),
        nasiya_total_debt_uzs=Decimal(total_debt or 0),
        failed_attempts_today=int(failed_today),
    )
