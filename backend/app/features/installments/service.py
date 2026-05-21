"""Installment business logic — schedules, payments, payoffs.

Money rules:
* a payment can be ``< amount_due`` (partial), ``== amount_due`` (paid), or
  ``> amount_due`` (overflow rolls into the next pending row);
* recording a payment never deletes a row — the schedule stays as proof;
* an early payoff zeroes-out all remaining rows in one shot, so the device
  card can show "Закрыта досрочно" without inventing fictional schedule rows.
"""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc, today_tashkent
from app.common.money import Currency, quantize
from app.features.installments import repository as repo
from app.features.installments.models import (
    InstallmentPayment,
    InstallmentPlan,
    PaymentKind,
    PaymentStatus,
    PlanStatus,
)
from app.features.installments.schedule import build_schedule


class InstallmentError(Exception):
    """Service-level errors mapped to HTTP by the router."""


class PlanNotFound(InstallmentError):
    pass


class PlanAlreadyExists(InstallmentError):
    """The sale already has a schedule — use the existing plan instead."""


class PlanInactive(InstallmentError):
    """Tried to pay against a completed or cancelled plan."""


class NothingOwed(InstallmentError):
    """Early payoff requested but the plan is already fully paid."""


# ─── Plan creation ────────────────────────────────────────────────────


async def create_plan(
    db: AsyncSession,
    *,
    shop_id: int,
    sale_id: int,
    total_amount: Decimal,
    down_payment: Decimal,
    period_type: str,
    period_count: int,
    start_date: date,
) -> tuple[InstallmentPlan, list[InstallmentPayment]]:
    """Build a fresh schedule for a nasiya sale."""
    if (existing := await repo.get_plan_for_sale(db, sale_id, shop_id=shop_id)):
        raise PlanAlreadyExists(f"plan {existing.id} already exists for sale {sale_id}")

    plan = InstallmentPlan(
        shop_id=shop_id,
        sale_id=sale_id,
        total_amount=quantize(total_amount, Currency.UZS),
        down_payment=quantize(down_payment, Currency.UZS),
        period_type=period_type,
        period_count=period_count,
        start_date=start_date,
        status=PlanStatus.ACTIVE.value,
    )
    plan = await repo.add_plan(db, plan)

    entries = build_schedule(
        total_amount=plan.total_amount,
        down_payment=plan.down_payment,
        start_date=plan.start_date,
        period_type=plan.period_type,
        period_count=plan.period_count,
    )

    payments = [
        InstallmentPayment(
            plan_id=plan.id,
            sequence=entry.sequence,
            due_date=entry.due_date,
            amount_due=entry.amount,
            amount_paid=Decimal("0"),
            status=PaymentStatus.PENDING.value,
            kind=PaymentKind.REGULAR.value,
        )
        for entry in entries
    ]
    await repo.add_payments(db, payments)
    return plan, payments


# ─── Status helpers ───────────────────────────────────────────────────


def _payment_status_for(amount_due: Decimal, amount_paid: Decimal, due: date) -> str:
    if amount_paid >= amount_due:
        return PaymentStatus.PAID.value
    if amount_paid > 0:
        return PaymentStatus.PARTIAL.value
    if due < today_tashkent():
        return PaymentStatus.OVERDUE.value
    return PaymentStatus.PENDING.value


async def _refresh_plan_status(db: AsyncSession, plan: InstallmentPlan) -> None:
    """Re-derive ``plan.status`` from its payment rows."""
    if not await repo.has_open_payments(db, plan.id):
        plan.status = PlanStatus.COMPLETED.value
        plan.completed_at = now_utc()
        return

    today = today_tashkent()
    payments = await repo.list_payments(db, plan.id)
    has_overdue = any(
        p.due_date < today
        and p.status in (PaymentStatus.PENDING.value, PaymentStatus.PARTIAL.value, PaymentStatus.OVERDUE.value)
        for p in payments
    )
    plan.status = (
        PlanStatus.OVERDUE.value if has_overdue else PlanStatus.ACTIVE.value
    )
    plan.completed_at = None


# ─── Read ──────────────────────────────────────────────────────────────


async def get_plan_or_404(
    db: AsyncSession, plan_id: int, *, shop_id: int
) -> InstallmentPlan:
    plan = await repo.get_plan(db, plan_id, shop_id=shop_id)
    if plan is None:
        raise PlanNotFound("plan not found")
    return plan


async def remaining(db: AsyncSession, plan: InstallmentPlan) -> Decimal:
    return await repo.remaining_balance(db, plan)


# ─── Recording a payment ──────────────────────────────────────────────


async def record_payment(
    db: AsyncSession,
    plan: InstallmentPlan,
    *,
    amount: Decimal,
    paid_at: datetime | None = None,
    note: str | None = None,
) -> list[InstallmentPayment]:
    """Apply ``amount`` to the earliest unpaid rows, in schedule order.

    Returns the list of payment rows that were touched (so the API caller
    can show "this payment closed periods 2 and 3").
    """
    if plan.status in (PlanStatus.COMPLETED.value, PlanStatus.CANCELLED.value):
        raise PlanInactive(f"plan is {plan.status}; no payments accepted")

    when = paid_at or now_utc()
    amount = quantize(amount, Currency.UZS)
    if amount <= 0:
        raise InstallmentError("amount must be positive")

    payments = await repo.list_payments(db, plan.id)

    touched: list[InstallmentPayment] = []
    leftover = amount

    for payment in payments:
        if leftover <= 0:
            break
        owed_here = payment.amount_due - payment.amount_paid
        if owed_here <= 0:
            continue  # already paid in full

        applied = min(leftover, owed_here)
        payment.amount_paid = quantize(payment.amount_paid + applied, Currency.UZS)
        leftover = quantize(leftover - applied, Currency.UZS)
        payment.status = _payment_status_for(
            payment.amount_due, payment.amount_paid, payment.due_date
        )
        if payment.status == PaymentStatus.PAID.value:
            payment.paid_at = when
        if note and not payment.note:
            payment.note = note
        payment.kind = (
            PaymentKind.REGULAR.value
            if payment.amount_paid >= payment.amount_due
            else PaymentKind.PARTIAL.value
        )
        touched.append(payment)

    if leftover > 0:
        # Buyer overpaid past the schedule — keep the receipt anyway by
        # appending a "credit" row. Rare but real (rounding up generosity).
        credit = InstallmentPayment(
            plan_id=plan.id,
            sequence=(payments[-1].sequence + 1) if payments else 1,
            due_date=when.date(),
            amount_due=leftover,
            amount_paid=leftover,
            status=PaymentStatus.PAID.value,
            kind=PaymentKind.REGULAR.value,
            paid_at=when,
            note="overpayment credit",
        )
        await repo.add_payments(db, [credit])
        touched.append(credit)

    await _refresh_plan_status(db, plan)
    return touched


# ─── Early payoff ─────────────────────────────────────────────────────


async def early_payoff(
    db: AsyncSession,
    plan: InstallmentPlan,
    *,
    paid_at: datetime | None = None,
    note: str | None = None,
) -> list[InstallmentPayment]:
    """Close every remaining row in one event.

    The unpaid amount of each open row is added to ``amount_paid`` and the
    row is marked ``closed_early`` (kind ``early_payoff``). One natural
    "Закрыта досрочно" event in the device card history.
    """
    if plan.status in (PlanStatus.COMPLETED.value, PlanStatus.CANCELLED.value):
        raise PlanInactive(f"plan is {plan.status}; nothing to pay off")

    when = paid_at or now_utc()
    payments = await repo.list_payments(db, plan.id)

    touched: list[InstallmentPayment] = []
    total_closed = Decimal("0")

    for payment in payments:
        owed_here = payment.amount_due - payment.amount_paid
        if owed_here <= 0:
            continue
        payment.amount_paid = quantize(
            payment.amount_paid + owed_here, Currency.UZS
        )
        total_closed = quantize(total_closed + owed_here, Currency.UZS)
        payment.status = PaymentStatus.CLOSED_EARLY.value
        payment.kind = PaymentKind.EARLY_PAYOFF.value
        payment.paid_at = when
        if note and not payment.note:
            payment.note = note
        touched.append(payment)

    if not touched:
        raise NothingOwed("plan is already fully paid")

    plan.status = PlanStatus.COMPLETED.value
    plan.completed_at = when
    return touched


# ─── Cancellation (sale returned) ─────────────────────────────────────


async def cancel_plan(
    plan: InstallmentPlan, *, reason: str | None = None
) -> InstallmentPlan:
    """Stop the plan when the sale is returned. Keeps the audit trail."""
    plan.status = PlanStatus.CANCELLED.value
    plan.cancelled_at = now_utc()
    plan.cancel_reason = reason
    return plan
