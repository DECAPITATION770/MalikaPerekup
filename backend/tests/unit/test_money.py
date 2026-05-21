"""Money helpers — Decimal-only, no float drift."""

from decimal import Decimal

from app.common.money import Currency, format_amount, quantize, to_uzs


def test_quantize_uzs_rounds_to_integer():
    assert quantize(Decimal("123456.78"), Currency.UZS) == Decimal("123457")


def test_quantize_usd_keeps_two_decimals():
    assert quantize(Decimal("100.555"), Currency.USD) == Decimal("100.56")


def test_to_uzs_uses_rate_for_usd():
    result = to_uzs(Decimal("350"), Currency.USD, Decimal("13100"))
    assert result == Decimal("4585000")


def test_to_uzs_ignores_rate_for_uzs():
    result = to_uzs(Decimal("4585000"), Currency.UZS, Decimal("99999"))
    assert result == Decimal("4585000")


def test_format_uzs_uses_thousand_separator():
    assert format_amount(Decimal("1200000"), Currency.UZS) == "1 200 000 сум"


def test_format_usd_two_decimals():
    assert format_amount(Decimal("350"), Currency.USD) == "$350.00"
