"""Installment schedule arithmetic — pure functions, no DB."""

from datetime import date
from decimal import Decimal

import pytest

from app.features.installments.schedule import build_schedule


def test_monthly_schedule_no_down_payment():
    schedule = build_schedule(
        total_amount=Decimal("1000000"),
        down_payment=Decimal("0"),
        start_date=date(2026, 1, 15),
        period_type="monthly",
        period_count=4,
    )
    assert len(schedule) == 4
    # Equal split: 1 000 000 / 4 = 250 000 each.
    assert all(entry.amount == Decimal("250000") for entry in schedule)
    # Sum matches.
    assert sum(e.amount for e in schedule) == Decimal("1000000")
    # Dates step by month.
    assert schedule[0].due_date == date(2026, 2, 15)
    assert schedule[1].due_date == date(2026, 3, 15)
    assert schedule[3].due_date == date(2026, 5, 15)


def test_remainder_lands_on_last_payment():
    """Rounding leftover should be added to the final payment exactly."""
    schedule = build_schedule(
        total_amount=Decimal("1000000"),
        down_payment=Decimal("0"),
        start_date=date(2026, 1, 1),
        period_type="monthly",
        period_count=3,
    )
    assert len(schedule) == 3
    # 1 000 000 / 3 = 333 333 base; last absorbs the remainder.
    assert schedule[0].amount == Decimal("333333")
    assert schedule[1].amount == Decimal("333333")
    assert schedule[2].amount == Decimal("333334")
    assert sum(e.amount for e in schedule) == Decimal("1000000")


def test_down_payment_appears_as_row_zero():
    schedule = build_schedule(
        total_amount=Decimal("1500000"),
        down_payment=Decimal("500000"),
        start_date=date(2026, 4, 26),
        period_type="monthly",
        period_count=4,
    )
    assert len(schedule) == 5  # down + 4 monthly
    assert schedule[0].sequence == 0
    assert schedule[0].due_date == date(2026, 4, 26)
    assert schedule[0].amount == Decimal("500000")
    # Remaining 1 000 000 split into 4 → 250 000 × 4.
    assert sum(e.amount for e in schedule[1:]) == Decimal("1000000")


def test_daily_period():
    schedule = build_schedule(
        total_amount=Decimal("70000"),
        down_payment=Decimal("0"),
        start_date=date(2026, 4, 26),
        period_type="daily",
        period_count=7,
    )
    assert schedule[0].due_date == date(2026, 4, 27)
    assert schedule[6].due_date == date(2026, 5, 3)


def test_month_end_clamping():
    """31 Jan + 1 month must clamp to 28/29 Feb, not raise."""
    schedule = build_schedule(
        total_amount=Decimal("100000"),
        down_payment=Decimal("0"),
        start_date=date(2026, 1, 31),
        period_type="monthly",
        period_count=2,
    )
    # 2026 is not a leap year — Feb has 28 days.
    assert schedule[0].due_date == date(2026, 2, 28)
    assert schedule[1].due_date == date(2026, 3, 31)


def test_invalid_inputs():
    with pytest.raises(ValueError):
        build_schedule(
            total_amount=Decimal("1000"),
            down_payment=Decimal("0"),
            start_date=date(2026, 1, 1),
            period_type="monthly",
            period_count=0,
        )
    with pytest.raises(ValueError):
        build_schedule(
            total_amount=Decimal("1000"),
            down_payment=Decimal("2000"),  # exceeds total
            start_date=date(2026, 1, 1),
            period_type="monthly",
            period_count=3,
        )
