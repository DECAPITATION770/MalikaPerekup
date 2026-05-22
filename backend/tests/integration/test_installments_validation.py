"""Regression tests for nasiya plan money-invariant validation.

Chaos-test findings (2026-05-22):
* #2 — down_payment > total_amount used to raise an uncaught ValueError
  from build_schedule() → HTTP 500. Now create_plan validates up front and
  raises InstallmentError (router maps to 400).
* total_amount <= 0 likewise rejected before building the schedule.

(The "plan total must equal sale price" guard, #3, lives in the router
since it needs the loaded Sale; it's covered by manual verification +
the SANITY path in test_full_cycle.)
"""

from datetime import date
from decimal import Decimal

import pytest

from app.features.installments import service


async def test_create_plan_rejects_down_payment_over_total(db):
    with pytest.raises(service.InstallmentError, match="down_payment"):
        await service.create_plan(
            db,
            shop_id=1,
            sale_id=999,
            total_amount=Decimal("3000000"),
            down_payment=Decimal("5000000"),  # > total
            period_type="monthly",
            period_count=6,
            start_date=date(2026, 6, 1),
        )


async def test_create_plan_rejects_negative_down_payment(db):
    with pytest.raises(service.InstallmentError, match="down_payment"):
        await service.create_plan(
            db,
            shop_id=1,
            sale_id=999,
            total_amount=Decimal("3000000"),
            down_payment=Decimal("-1"),
            period_type="monthly",
            period_count=6,
            start_date=date(2026, 6, 1),
        )


async def test_create_plan_rejects_non_positive_total(db):
    with pytest.raises(service.InstallmentError, match="total_amount"):
        await service.create_plan(
            db,
            shop_id=1,
            sale_id=999,
            total_amount=Decimal("0"),
            down_payment=Decimal("0"),
            period_type="monthly",
            period_count=6,
            start_date=date(2026, 6, 1),
        )
