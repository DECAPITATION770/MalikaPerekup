"""Database queries for installment plans and their payments."""

from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.counterparties.models import Counterparty
from app.features.devices.models import Device
from app.features.installments.models import (
    InstallmentPayment,
    InstallmentPlan,
    PaymentStatus,
    PlanStatus,
)
from app.features.sales.models import Sale


async def get_plan(
    db: AsyncSession, plan_id: int, *, shop_id: int
) -> InstallmentPlan | None:
    result = await db.execute(
        select(InstallmentPlan).where(
            InstallmentPlan.id == plan_id, InstallmentPlan.shop_id == shop_id
        )
    )
    return result.scalar_one_or_none()


async def get_plan_for_sale(
    db: AsyncSession, sale_id: int, *, shop_id: int
) -> InstallmentPlan | None:
    """One sale → at most one plan; convenience lookup for the device card."""
    result = await db.execute(
        select(InstallmentPlan).where(
            InstallmentPlan.sale_id == sale_id,
            InstallmentPlan.shop_id == shop_id,
        )
    )
    return result.scalar_one_or_none()


async def list_payments(
    db: AsyncSession, plan_id: int
) -> list[InstallmentPayment]:
    result = await db.execute(
        select(InstallmentPayment)
        .where(InstallmentPayment.plan_id == plan_id)
        .order_by(InstallmentPayment.sequence)
    )
    return list(result.scalars().all())


async def get_payment(
    db: AsyncSession, payment_id: int
) -> InstallmentPayment | None:
    return await db.get(InstallmentPayment, payment_id)


async def search_plans(
    db: AsyncSession,
    *,
    shop_id: int,
    status: str | None,
    limit: int,
    offset: int,
) -> tuple[
    list[tuple[InstallmentPlan, str | None, str | None, str | None,
               Decimal, int, int, int | None, str | None, str | None, int | None]],
    int,
]:
    """List a shop's plans, paired with debtor contact + payment progress.

    Returns rows of ``(plan, buyer_name, buyer_phone, buyer_tg_username,
    paid_amount, paid_count, payments_count, device_id, device_brand,
    device_model, counterparty_id)``. The progress aggregate is a per-plan
    correlated subquery so the result is a single round-trip.
    """
    # Per-plan aggregates over InstallmentPayment — correlated subqueries
    # keep the row shape one-per-plan even when payments are many.
    paid_amount_sq = (
        select(func.coalesce(func.sum(InstallmentPayment.amount_paid), 0))
        .where(InstallmentPayment.plan_id == InstallmentPlan.id)
        .correlate(InstallmentPlan)
        .scalar_subquery()
    )
    paid_count_sq = (
        select(func.count(InstallmentPayment.id))
        .where(
            InstallmentPayment.plan_id == InstallmentPlan.id,
            InstallmentPayment.status.in_(
                (PaymentStatus.PAID.value, PaymentStatus.CLOSED_EARLY.value)
            ),
        )
        .correlate(InstallmentPlan)
        .scalar_subquery()
    )
    payments_count_sq = (
        select(func.count(InstallmentPayment.id))
        .where(InstallmentPayment.plan_id == InstallmentPlan.id)
        .correlate(InstallmentPlan)
        .scalar_subquery()
    )

    base = (
        select(
            InstallmentPlan,
            Sale.buyer_name,
            Sale.buyer_phone,
            Counterparty.tg_username,
            paid_amount_sq.label("paid_amount"),
            paid_count_sq.label("paid_count"),
            payments_count_sq.label("payments_count"),
            Sale.device_id,
            Device.brand,
            Device.model,
            Sale.counterparty_id,
        )
        .join(Sale, Sale.id == InstallmentPlan.sale_id)
        .outerjoin(Counterparty, Counterparty.id == Sale.counterparty_id)
        .outerjoin(Device, Device.id == Sale.device_id)
        .where(InstallmentPlan.shop_id == shop_id)
    )
    if status:
        base = base.where(InstallmentPlan.status == status)

    count_stmt = select(func.count(InstallmentPlan.id)).where(
        InstallmentPlan.shop_id == shop_id
    )
    if status:
        count_stmt = count_stmt.where(InstallmentPlan.status == status)
    total = (await db.execute(count_stmt)).scalar_one()

    rows = (
        await db.execute(
            base.order_by(InstallmentPlan.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [tuple(r) for r in rows], total


async def list_due_today_or_overdue(
    db: AsyncSession, *, today: date
) -> list[InstallmentPayment]:
    """Used by the morning bot scheduler (stage 11)."""
    result = await db.execute(
        select(InstallmentPayment).where(
            InstallmentPayment.due_date <= today,
            InstallmentPayment.status.in_(
                (PaymentStatus.PENDING.value, PaymentStatus.OVERDUE.value)
            ),
        )
    )
    return list(result.scalars().all())


async def remaining_balance(db: AsyncSession, plan: InstallmentPlan) -> Decimal:
    """Sum of unpaid amounts across the plan's schedule rows."""
    result = await db.execute(
        select(func.coalesce(func.sum(InstallmentPayment.amount_paid), 0)).where(
            InstallmentPayment.plan_id == plan.id
        )
    )
    paid = result.scalar_one()
    return plan.total_amount - paid


async def outstanding_debt(
    db: AsyncSession, *, shop_id: int | None = None
) -> Decimal:
    """Total remaining nasiya debt across active + overdue plans.

    The single source of truth for the "Долги по рассрочке" KPI (tenant
    dashboard, admin shop stats, admin platform stats).

    Computed as ``SUM(total_amount) - SUM(amount_paid)`` via TWO separate
    aggregates. A single ``plan -> payments`` join must NOT be used: it fans
    out ``total_amount`` once per payment row, so a 4-row plan would count its
    total 4× (the classic "debt shows 23M instead of 5M" bug).

    ``shop_id=None`` aggregates across the whole platform (admin).
    """
    active = (PlanStatus.ACTIVE.value, PlanStatus.OVERDUE.value)
    plan_filter = [InstallmentPlan.status.in_(active)]
    if shop_id is not None:
        plan_filter.append(InstallmentPlan.shop_id == shop_id)

    total_owed = (
        await db.execute(
            select(func.coalesce(func.sum(InstallmentPlan.total_amount), 0)).where(
                *plan_filter
            )
        )
    ).scalar_one()
    total_paid = (
        await db.execute(
            select(func.coalesce(func.sum(InstallmentPayment.amount_paid), 0))
            .select_from(InstallmentPayment)
            .join(InstallmentPlan, InstallmentPlan.id == InstallmentPayment.plan_id)
            .where(*plan_filter)
        )
    ).scalar_one()
    return Decimal(total_owed) - Decimal(total_paid)


async def has_open_payments(db: AsyncSession, plan_id: int) -> bool:
    """True when at least one payment row is still owed."""
    result = await db.execute(
        select(func.count(InstallmentPayment.id)).where(
            InstallmentPayment.plan_id == plan_id,
            InstallmentPayment.status.in_(
                (
                    PaymentStatus.PENDING.value,
                    PaymentStatus.PARTIAL.value,
                    PaymentStatus.OVERDUE.value,
                )
            ),
        )
    )
    return result.scalar_one() > 0


async def add_plan(db: AsyncSession, plan: InstallmentPlan) -> InstallmentPlan:
    db.add(plan)
    await db.flush()
    return plan


async def add_payments(
    db: AsyncSession, payments: list[InstallmentPayment]
) -> None:
    db.add_all(payments)
    await db.flush()
