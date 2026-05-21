"""Profit formula — the single source of truth for "сколько заработали"."""

from decimal import Decimal

from app.features.sales.profit_calc import compute_profit


def test_positive_profit():
    assert compute_profit(
        sale_price_uzs=Decimal("1500000"),
        purchase_price_uzs=Decimal("1200000"),
    ) == Decimal("300000.00")


def test_negative_profit_allowed():
    """Selling below purchase price is real (clearing slow stock)."""
    assert compute_profit(
        sale_price_uzs=Decimal("900000"),
        purchase_price_uzs=Decimal("1000000"),
    ) == Decimal("-100000.00")


def test_zero_profit():
    assert compute_profit(
        sale_price_uzs=Decimal("500000"),
        purchase_price_uzs=Decimal("500000"),
    ) == Decimal("0.00")


def test_decimal_precision():
    """UZS is integer-rounded but the type is still Decimal."""
    result = compute_profit(
        sale_price_uzs=Decimal("100.50"),
        purchase_price_uzs=Decimal("99.50"),
    )
    assert result == Decimal("1.00")
    assert isinstance(result, Decimal)
