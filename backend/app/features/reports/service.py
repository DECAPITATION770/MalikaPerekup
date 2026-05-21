"""Aggregating queries that power the dashboard and period reports.

Read-only — no models of its own. Every query filters by ``shop_id`` so
multi-tenancy is preserved automatically.

Returned/cancelled sales are deliberately excluded from revenue and profit:
they did not happen from a financial standpoint. They surface separately
as ``returns_count``.
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import days_ago, today_tashkent
from app.common.money import Currency, quantize
from app.features.devices.models import Device, DeviceStatus
from app.features.installments.models import (
    InstallmentPayment,
    InstallmentPlan,
    PaymentStatus,
    PlanStatus,
)
from app.features.purchases.models import Purchase
from app.features.reports.schemas import (
    DayProfit,
    InventoryValueReport,
    PeriodReport,
    TodayDashboard,
    TopModelEntry,
)
from app.features.sales.models import Sale, SaleStatus

ZERO = Decimal("0")


def _coalesce(value: Decimal | None) -> Decimal:
    """SQL ``coalesce(SUM(..), 0)`` returns Decimal in pg, but Python sums of
    empty selects return None — normalise here."""
    return quantize(value or ZERO, Currency.UZS)


# ─── Today dashboard ───────────────────────────────────────────────────


async def today_dashboard(db: AsyncSession, *, shop_id: int) -> TodayDashboard:
    today = today_tashkent()

    # 1. Today's profit and revenue (active sales only).
    sale_agg = (
        await db.execute(
            select(
                func.coalesce(func.sum(Sale.profit_uzs), 0),
                func.coalesce(func.sum(Sale.sale_price_uzs), 0),
                func.count(Sale.id),
            ).where(
                Sale.shop_id == shop_id,
                Sale.sale_date == today,
                Sale.status == SaleStatus.ACTIVE.value,
            )
        )
    ).one()
    profit_today, revenue_today, sales_count_today = sale_agg

    # 1b. Yesterday's profit — drives the headline ↑/↓ delta.
    profit_yesterday = (
        await db.execute(
            select(func.coalesce(func.sum(Sale.profit_uzs), 0)).where(
                Sale.shop_id == shop_id,
                Sale.sale_date == days_ago(1),
                Sale.status == SaleStatus.ACTIVE.value,
            )
        )
    ).scalar_one()

    # 2. Today's purchases count.
    purchases_count_today = (
        await db.execute(
            select(func.count(Purchase.id)).where(
                Purchase.shop_id == shop_id,
                Purchase.purchase_date == today,
            )
        )
    ).scalar_one()

    # 3. In-stock count and inventory value (sum of original purchase prices).
    inventory = (
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
    in_stock_count, inventory_value = inventory

    # 4. Outstanding nasiya debt across active and overdue plans.
    debt_query = (
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
            InstallmentPlan.shop_id == shop_id,
            InstallmentPlan.status.in_(
                (PlanStatus.ACTIVE.value, PlanStatus.OVERDUE.value)
            ),
        )
    )
    nasiya_debt = (await db.execute(debt_query)).scalar_one()

    # 5. Number of payment rows past due and not yet fully paid.
    overdue_count = (
        await db.execute(
            select(func.count(InstallmentPayment.id))
            .select_from(InstallmentPayment)
            .join(
                InstallmentPlan,
                InstallmentPlan.id == InstallmentPayment.plan_id,
            )
            .where(
                InstallmentPlan.shop_id == shop_id,
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

    return TodayDashboard(
        today=today,
        profit_today=_coalesce(profit_today),
        profit_yesterday=_coalesce(profit_yesterday),
        revenue_today=_coalesce(revenue_today),
        sales_count_today=int(sales_count_today),
        purchases_count_today=int(purchases_count_today),
        in_stock_count=int(in_stock_count),
        inventory_value_uzs=_coalesce(inventory_value),
        nasiya_debt_uzs=_coalesce(nasiya_debt),
        overdue_payments_count=int(overdue_count),
    )


# ─── Period report ─────────────────────────────────────────────────────


async def period_report(
    db: AsyncSession,
    *,
    shop_id: int,
    date_from: date,
    date_to: date,
    top_n: int = 5,
) -> PeriodReport:
    # Purchases inside the range.
    purchases_agg = (
        await db.execute(
            select(
                func.count(Purchase.id),
                func.coalesce(func.sum(Purchase.price_uzs), 0),
            ).where(
                Purchase.shop_id == shop_id,
                Purchase.purchase_date >= date_from,
                Purchase.purchase_date <= date_to,
            )
        )
    ).one()
    purchases_count, purchases_total = purchases_agg

    # Active sales inside the range — what the user actually earned.
    sales_agg = (
        await db.execute(
            select(
                func.count(Sale.id),
                func.coalesce(func.sum(Sale.sale_price_uzs), 0),
                func.coalesce(func.sum(Sale.profit_uzs), 0),
            ).where(
                Sale.shop_id == shop_id,
                Sale.sale_date >= date_from,
                Sale.sale_date <= date_to,
                Sale.status == SaleStatus.ACTIVE.value,
            )
        )
    ).one()
    sales_count, revenue, profit = sales_agg

    # Returns recorded inside the range — surfaced separately as a metric.
    returns_count = (
        await db.execute(
            select(func.count(Sale.id)).where(
                Sale.shop_id == shop_id,
                Sale.status == SaleStatus.RETURNED.value,
                Sale.returned_at.is_not(None),
                func.date(Sale.returned_at) >= date_from,
                func.date(Sale.returned_at) <= date_to,
            )
        )
    ).scalar_one()

    avg_profit = (
        quantize(profit / sales_count, Currency.UZS)
        if sales_count
        else ZERO
    )

    # Top models by total profit (active sales only).
    top_rows = (
        await db.execute(
            select(
                Device.brand,
                Device.model,
                func.count(Sale.id).label("units_sold"),
                func.sum(Sale.profit_uzs).label("total_profit"),
            )
            .select_from(Sale)
            .join(Device, Device.id == Sale.device_id)
            .where(
                Sale.shop_id == shop_id,
                Sale.sale_date >= date_from,
                Sale.sale_date <= date_to,
                Sale.status == SaleStatus.ACTIVE.value,
            )
            .group_by(Device.brand, Device.model)
            .order_by(func.sum(Sale.profit_uzs).desc())
            .limit(top_n)
        )
    ).all()

    top_models = [
        TopModelEntry(
            brand=row.brand,
            model=row.model,
            units_sold=int(row.units_sold),
            total_profit_uzs=_coalesce(row.total_profit),
        )
        for row in top_rows
    ]

    # Average days a sold device spent in stock (purchase_date → sale_date).
    days_query = (
        select(
            func.avg(
                # PostgreSQL: date - date returns int days. Wrap in cast for safety.
                Sale.sale_date - Purchase.purchase_date
            )
        )
        .select_from(Sale)
        .join(Purchase, Purchase.device_id == Sale.device_id)
        .where(
            Sale.shop_id == shop_id,
            Sale.sale_date >= date_from,
            Sale.sale_date <= date_to,
            Sale.status == SaleStatus.ACTIVE.value,
        )
    )
    avg_days_raw = (await db.execute(days_query)).scalar_one()
    avg_days = float(avg_days_raw) if avg_days_raw is not None else None

    # Daily profit, zero-filled across the whole range for a continuous
    # sparkline (a day with no sales is a real 0, not a missing point).
    day_rows = (
        await db.execute(
            select(
                Sale.sale_date,
                func.coalesce(func.sum(Sale.profit_uzs), 0),
            )
            .where(
                Sale.shop_id == shop_id,
                Sale.sale_date >= date_from,
                Sale.sale_date <= date_to,
                Sale.status == SaleStatus.ACTIVE.value,
            )
            .group_by(Sale.sale_date)
        )
    ).all()
    by_day = {row[0]: row[1] for row in day_rows}
    profit_by_day: list[DayProfit] = []
    cursor = date_from
    while cursor <= date_to:
        profit_by_day.append(
            DayProfit(day=cursor, profit_uzs=_coalesce(by_day.get(cursor)))
        )
        cursor += timedelta(days=1)

    return PeriodReport(
        date_from=date_from,
        date_to=date_to,
        purchases_count=int(purchases_count),
        purchases_total_uzs=_coalesce(purchases_total),
        sales_count=int(sales_count),
        revenue_uzs=_coalesce(revenue),
        profit_uzs=_coalesce(profit),
        avg_profit_per_sale_uzs=avg_profit,
        returns_count=int(returns_count),
        top_models=top_models,
        avg_days_in_stock=avg_days,
        profit_by_day=profit_by_day,
    )


# ─── Inventory value detail ────────────────────────────────────────────


async def inventory_value(
    db: AsyncSession, *, shop_id: int
) -> InventoryValueReport:
    """Per-category breakdown behind the dashboard's "Заморожено" tile."""
    rows = (
        await db.execute(
            select(
                Device.category,
                func.count(Device.id),
                func.coalesce(func.sum(Purchase.price_uzs), 0),
            )
            .select_from(Device)
            .join(Purchase, Purchase.device_id == Device.id)
            .where(
                Device.shop_id == shop_id,
                Device.status == DeviceStatus.IN_STOCK.value,
            )
            .group_by(Device.category)
        )
    ).all()

    by_category = {row[0]: _coalesce(row[2]) for row in rows}
    total_count = sum(int(row[1]) for row in rows)
    total_value = quantize(sum(by_category.values(), ZERO), Currency.UZS)

    return InventoryValueReport(
        in_stock_count=total_count,
        inventory_value_uzs=total_value,
        by_category=by_category,
    )
