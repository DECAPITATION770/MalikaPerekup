"""Database queries for ``counterparties``.

Every query is filtered by ``shop_id`` — never expose another shop's data.
``deleted_at IS NULL`` is the soft-delete filter applied by default.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.counterparties.models import Counterparty
from app.features.counterparties.notes_model import CounterpartyNote
from app.features.installments.models import (
    InstallmentPayment,
    InstallmentPlan,
    PlanStatus,
)
from app.features.purchases.models import Purchase
from app.features.sales.models import Sale


async def get_by_id(
    db: AsyncSession, counterparty_id: int, *, shop_id: int
) -> Counterparty | None:
    """Fetch one counterparty inside ``shop_id`` (returns None if hidden)."""
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.id == counterparty_id,
            Counterparty.shop_id == shop_id,
            Counterparty.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def find_by_phone(
    db: AsyncSession, phone: str, *, shop_id: int
) -> Counterparty | None:
    """Used during purchase/sale to suggest an existing counterparty."""
    result = await db.execute(
        select(Counterparty).where(
            Counterparty.shop_id == shop_id,
            Counterparty.phone == phone,
            Counterparty.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def search(
    db: AsyncSession,
    *,
    shop_id: int,
    query: str | None,
    type_: str | None,
    limit: int,
    offset: int,
) -> tuple[list[Counterparty], int]:
    """Search counterparties by name or phone, optionally filtered by ``type``.

    Returns ``(items, total)`` so the caller can build a paged response.
    """
    base = select(Counterparty).where(
        Counterparty.shop_id == shop_id,
        Counterparty.deleted_at.is_(None),
    )

    if type_ in ("seller", "buyer", "both"):
        # ``both`` rows always match either filter — mirrors UI expectation.
        if type_ == "both":
            base = base.where(Counterparty.type == "both")
        else:
            base = base.where(Counterparty.type.in_((type_, "both")))

    if query:
        like = f"%{query}%"
        base = base.where(
            or_(
                Counterparty.full_name.ilike(like),
                Counterparty.phone.ilike(like),
            )
        )

    total_q = select(func.count()).select_from(base.subquery())
    total = (await db.execute(total_q)).scalar_one()

    items_q = (
        base.order_by(Counterparty.updated_at.desc()).limit(limit).offset(offset)
    )
    items = (await db.execute(items_q)).scalars().all()
    return list(items), total


async def create(db: AsyncSession, **fields) -> Counterparty:
    counterparty = Counterparty(**fields)
    db.add(counterparty)
    await db.flush()
    return counterparty


async def stats_for_counterparty(
    db: AsyncSession,
    *,
    shop_id: int,
    counterparty_id: int,
) -> dict[str, int | Decimal]:
    """Lifetime money + count rollups for one counterparty.

    Returns purchases/sales totals (in UZS) plus deal counts plus the number
    of active nasiya plans tied to this person. Single query per rollup —
    Postgres aggregates a few rows so even for a clumsy directory the
    response is sub-millisecond.

    The shop_id appears in every WHERE so a counterparty row leaking into
    another shop's aggregate is impossible (CLAUDE.md §6 invariant).
    """
    purchases_total_q = select(
        func.coalesce(func.sum(Purchase.price_uzs), 0),
        func.count(Purchase.id),
    ).where(
        Purchase.shop_id == shop_id,
        Purchase.counterparty_id == counterparty_id,
    )
    # `Sale.sale_price_uzs` is the column name — `price_uzs` is the
    # *purchase*-side name. The aggregate stays in UZS regardless of
    # the original currency (sale_price_uzs is denormalised at write).
    sales_total_q = select(
        func.coalesce(func.sum(Sale.sale_price_uzs), 0),
        func.count(Sale.id),
    ).where(
        Sale.shop_id == shop_id,
        Sale.counterparty_id == counterparty_id,
    )
    nasiya_active_q = (
        select(func.count(InstallmentPlan.id))
        .select_from(InstallmentPlan)
        .join(Sale, Sale.id == InstallmentPlan.sale_id)
        .where(
            InstallmentPlan.shop_id == shop_id,
            InstallmentPlan.status == PlanStatus.ACTIVE.value,
            Sale.counterparty_id == counterparty_id,
        )
    )

    # Last contact = newest of (last purchase, last sale, last note). Used
    # by the «не общались N дней» banner on CounterpartyDetail. A
    # counterparty with zero deals but a note from today still reads as
    # fresh; one with a year-old sale and no notes reads as stale.
    last_contact_q = (
        select(
            func.greatest(
                select(func.max(Purchase.created_at))
                .where(
                    Purchase.shop_id == shop_id,
                    Purchase.counterparty_id == counterparty_id,
                )
                .scalar_subquery(),
                select(func.max(Sale.created_at))
                .where(
                    Sale.shop_id == shop_id,
                    Sale.counterparty_id == counterparty_id,
                )
                .scalar_subquery(),
                select(func.max(CounterpartyNote.created_at))
                .where(
                    CounterpartyNote.shop_id == shop_id,
                    CounterpartyNote.counterparty_id == counterparty_id,
                )
                .scalar_subquery(),
            )
        )
    )

    purchases_sum, purchases_count = (
        await db.execute(purchases_total_q)
    ).one()
    sales_sum, sales_count = (await db.execute(sales_total_q)).one()
    active_nasiya = (await db.execute(nasiya_active_q)).scalar_one()
    last_contact = (await db.execute(last_contact_q)).scalar_one_or_none()

    return {
        "purchases_total_uzs": Decimal(purchases_sum or 0),
        "purchases_count": int(purchases_count or 0),
        "sales_total_uzs": Decimal(sales_sum or 0),
        "sales_count": int(sales_count or 0),
        "active_nasiya_count": int(active_nasiya or 0),
        "last_contact_at": last_contact,
    }


async def search_with_aggregates(
    db: AsyncSession,
    *,
    shop_id: int,
    query: str | None,
    type_: str | None,
    limit: int,
    offset: int,
) -> tuple[list[tuple[Counterparty, int, Decimal, datetime | None]], int]:
    """Like :func:`search` but joins per-row aggregates needed for the
    directory list: total deal count (sales-as-buyer + purchases-as-seller),
    outstanding nasiya debt across active plans (buyer side only — cash sales
    contribute zero), and the timestamp of the most recent deal.

    Every aggregate subquery is also filtered by ``shop_id`` so a counterparty
    row in shop A can never inherit shop B's sales/plans even if the id space
    happened to collide.
    """
    sales_agg = (
        select(
            Sale.counterparty_id.label("cp_id"),
            func.count(Sale.id).label("n"),
            func.max(Sale.created_at).label("last_at"),
        )
        .where(Sale.shop_id == shop_id, Sale.counterparty_id.is_not(None))
        .group_by(Sale.counterparty_id)
        .subquery()
    )
    purch_agg = (
        select(
            Purchase.counterparty_id.label("cp_id"),
            func.count(Purchase.id).label("n"),
            func.max(Purchase.created_at).label("last_at"),
        )
        .where(Purchase.shop_id == shop_id, Purchase.counterparty_id.is_not(None))
        .group_by(Purchase.counterparty_id)
        .subquery()
    )
    # Per-plan paid-so-far rolled up first; outer join keeps plans with no
    # payments yet (e.g. brand-new schedules) so they still owe ``total_amount``.
    paid_per_plan = (
        select(
            InstallmentPayment.plan_id.label("plan_id"),
            func.sum(InstallmentPayment.amount_paid).label("paid"),
        )
        .group_by(InstallmentPayment.plan_id)
        .subquery()
    )
    debt_agg = (
        select(
            Sale.counterparty_id.label("cp_id"),
            func.sum(
                InstallmentPlan.total_amount
                - func.coalesce(paid_per_plan.c.paid, 0)
            ).label("owed"),
        )
        .select_from(InstallmentPlan)
        .join(Sale, Sale.id == InstallmentPlan.sale_id)
        .join(
            paid_per_plan,
            paid_per_plan.c.plan_id == InstallmentPlan.id,
            isouter=True,
        )
        .where(
            InstallmentPlan.shop_id == shop_id,
            InstallmentPlan.status == PlanStatus.ACTIVE.value,
            Sale.counterparty_id.is_not(None),
        )
        .group_by(Sale.counterparty_id)
        .subquery()
    )

    base_filters = [
        Counterparty.shop_id == shop_id,
        Counterparty.deleted_at.is_(None),
    ]
    if type_ in ("seller", "buyer", "both"):
        if type_ == "both":
            base_filters.append(Counterparty.type == "both")
        else:
            base_filters.append(Counterparty.type.in_((type_, "both")))
    if query:
        like = f"%{query}%"
        base_filters.append(
            or_(
                Counterparty.full_name.ilike(like),
                Counterparty.phone.ilike(like),
            )
        )

    items_q = (
        select(
            Counterparty,
            (
                func.coalesce(sales_agg.c.n, 0)
                + func.coalesce(purch_agg.c.n, 0)
            ).label("deals"),
            func.coalesce(debt_agg.c.owed, 0).label("owed"),
            # GREATEST ignores NULLs in PostgreSQL — returns NULL only when
            # both inputs are NULL (i.e. the counterparty has no deals yet).
            func.greatest(sales_agg.c.last_at, purch_agg.c.last_at).label("last_at"),
        )
        .select_from(Counterparty)
        .outerjoin(sales_agg, sales_agg.c.cp_id == Counterparty.id)
        .outerjoin(purch_agg, purch_agg.c.cp_id == Counterparty.id)
        .outerjoin(debt_agg, debt_agg.c.cp_id == Counterparty.id)
        .where(*base_filters)
        # Pinned-first is a DB-level ordering so paginated lists stay
        # consistent across pages. Within pinned/unpinned groups the
        # frontend re-sorts by debt/recency (priorities the DB doesn't
        # know about — debt depends on the joined aggregate).
        .order_by(
            Counterparty.is_pinned.desc(),
            Counterparty.updated_at.desc(),
        )
        .limit(limit)
        .offset(offset)
    )

    total_q = select(func.count(Counterparty.id)).where(*base_filters)
    total = (await db.execute(total_q)).scalar_one()

    rows = (await db.execute(items_q)).all()
    items: list[tuple[Counterparty, int, Decimal, datetime | None]] = [
        (row[0], int(row[1]), Decimal(row[2] or 0), row[3]) for row in rows
    ]
    return items, total
