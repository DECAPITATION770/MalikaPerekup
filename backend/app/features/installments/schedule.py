"""Pure schedule arithmetic — no database, no I/O.

Splits an installment plan into ``period_count`` equal payments and shifts
any rounding remainder into the **last** row so the sum always matches
``total_amount`` to the cent. Easier to reason about for the buyer
(``"последний платёж чуть больше"``) than spreading the remainder.
"""

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from app.common.money import Currency, quantize
from app.features.installments.models import PeriodType


@dataclass(frozen=True)
class ScheduleEntry:
    sequence: int
    due_date: date
    amount: Decimal


def _next_due_date(start: date, period_type: str, step: int) -> date:
    """Compute the ``step``-th due date after ``start`` for ``period_type``."""
    if period_type == PeriodType.DAILY.value:
        return start + timedelta(days=step)
    if period_type == PeriodType.WEEKLY.value:
        return start + timedelta(weeks=step)
    if period_type == PeriodType.MONTHLY.value:
        # Naive month addition: keep the same day-of-month, clamp to month end.
        month = start.month + step
        year = start.year + (month - 1) // 12
        month = ((month - 1) % 12) + 1
        # Clamp to last valid day of the resulting month.
        from calendar import monthrange

        day = min(start.day, monthrange(year, month)[1])
        return date(year, month, day)
    raise ValueError(f"unknown period_type: {period_type!r}")


def build_schedule(
    *,
    total_amount: Decimal,
    down_payment: Decimal,
    start_date: date,
    period_type: str,
    period_count: int,
) -> list[ScheduleEntry]:
    """Return the full payment schedule, including the down payment as row 0.

    The remainder caused by integer rounding lands on the last entry so
    that ``sum(amounts) == total_amount`` exactly.
    """
    if period_count < 1:
        raise ValueError("period_count must be >= 1")
    if down_payment < 0 or down_payment > total_amount:
        raise ValueError("down_payment must be between 0 and total_amount")

    schedule: list[ScheduleEntry] = []

    # Row 0: the down payment, due "today" (start_date).
    if down_payment > 0:
        schedule.append(
            ScheduleEntry(
                sequence=0,
                due_date=start_date,
                amount=quantize(down_payment, Currency.UZS),
            )
        )

    remaining = total_amount - down_payment
    base = quantize(remaining / period_count, Currency.UZS)

    accumulated = Decimal("0")
    for i in range(1, period_count + 1):
        is_last = i == period_count
        amount = (remaining - accumulated) if is_last else base
        accumulated += amount
        schedule.append(
            ScheduleEntry(
                sequence=i,
                due_date=_next_due_date(start_date, period_type, i),
                amount=quantize(amount, Currency.UZS),
            )
        )

    return schedule
