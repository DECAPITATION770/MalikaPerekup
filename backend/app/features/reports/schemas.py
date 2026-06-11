"""Response shapes for ``/reports/*`` endpoints.

All money is UZS. ``Decimal`` is serialised as JSON string by Pydantic, so
the frontend never sees floating-point drift.
"""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class TodayDashboard(BaseModel):
    """Top-of-screen "Сегодня" summary the user sees on app open."""

    today: date

    profit_today: Decimal
    """SUM(profit_uzs) for active sales with sale_date == today."""

    profit_yesterday: Decimal
    """Same metric for yesterday — lets the UI show a ↑/↓ delta so the
    headline number carries a "good or bad" signal, not just a value."""

    revenue_today: Decimal
    """SUM(sale_price_uzs) for active sales with sale_date == today."""

    sales_count_today: int
    purchases_count_today: int

    in_stock_count: int
    inventory_value_uzs: Decimal
    """Money locked in the showcase: SUM(purchase price) of in_stock devices."""

    nasiya_debt_uzs: Decimal
    """SUM of remaining balances across active+overdue plans."""

    overdue_payments_count: int
    """How many payment rows are past due and not yet paid in full."""


class TopModelEntry(BaseModel):
    brand: str
    model: str
    units_sold: int
    total_profit_uzs: Decimal


class DayProfit(BaseModel):
    """One point of the period's daily-profit sparkline."""

    day: date
    profit_uzs: Decimal


class PeriodReport(BaseModel):
    """Aggregates over a date range (inclusive on both sides)."""

    date_from: date
    date_to: date

    purchases_count: int
    purchases_total_uzs: Decimal

    sales_count: int
    revenue_uzs: Decimal
    profit_uzs: Decimal
    avg_profit_per_sale_uzs: Decimal
    """``profit_uzs / sales_count`` (zero when no sales — never NaN)."""

    returns_count: int

    top_models: list[TopModelEntry]
    avg_days_in_stock: float | None
    """Average days between purchase_date and sale_date, ``None`` if no sales."""

    profit_by_day: list[DayProfit]
    """One entry per calendar day in range (gaps zero-filled) so the
    frontend can draw a continuous profit sparkline."""


class BreakdownRow(BaseModel):
    """One group in a report-builder breakdown (a brand, a category, …)."""

    key: str
    """Stable machine key for the group (e.g. ``"phone"``, ``"Apple"``)."""
    label: str
    """Human label shown in the table (e.g. ``"Apple iPhone 13"`` for models)."""
    units_sold: int
    revenue_uzs: Decimal
    profit_uzs: Decimal
    margin_pct: float
    """``profit / revenue * 100`` rounded to 1 dp; 0.0 when revenue is 0."""


class BreakdownReport(BaseModel):
    """Grouped active-sales aggregates over a period — powers the report
    builder ("Конструктор"). Rows are sorted by profit descending."""

    group_by: str
    date_from: date
    date_to: date
    rows: list[BreakdownRow]
    total_units: int
    total_revenue_uzs: Decimal
    total_profit_uzs: Decimal


class InventoryValueReport(BaseModel):
    """Detail behind the "Заморожено" tile on the dashboard."""

    in_stock_count: int
    inventory_value_uzs: Decimal
    by_category: dict[str, Decimal]
    """Per-category breakdown: ``{"phone": "12 000 000", "laptop": "3 200 000"}``."""
