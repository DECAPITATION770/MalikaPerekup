"""Background jobs that produce notifications and refresh the CBU rate.

Four jobs run inside the FastAPI process via APScheduler:

* **08:00 Asia/Tashkent daily** — for every shop, build a "today" digest
  (number of payments due, total expected, overdue count) and enqueue it
  for the owner.
* **09:00 Asia/Tashkent daily** — mirror the official Central Bank of
  Uzbekistan USD→UZS rate into ``cbu_rate_cache`` for the purchase form.
* **Every hour** — find payment rows whose ``due_date`` has passed and
  status is still pending/partial; mark them ``overdue`` and enqueue a
  per-payment overdue notification (idempotent via ``dedup_key``).
* **Every 30 seconds** — flush the outbox: send pending notifications
  through the registered channels.
"""

from datetime import date
from decimal import Decimal

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import TASHKENT, today_tashkent
from app.core.database import SessionFactory
from app.features.devices.models import Device
from app.features.exchange import service as exchange_service
from app.features.installments import repository as plan_repo
from app.features.installments.models import (
    InstallmentPayment,
    InstallmentPlan,
    PaymentStatus,
)
from app.features.notifications import service as notify_service
from app.features.notifications.models import NotificationKind
from app.features.sales.models import Sale
from app.features.shops.models import Shop


# ─── Job: 08:00 morning summary per shop ───────────────────────────────


async def _send_daily_summaries() -> None:
    async with SessionFactory() as db:
        shops = (await db.execute(select(Shop))).scalars().all()
        today = today_tashkent()
        for shop in shops:
            summary = await _build_summary(db, shop_id=shop.id, today=today)
            if summary["payments_count"] == 0 and summary["overdue_count"] == 0:
                # Nothing interesting to say today — skip.
                continue
            await notify_service.enqueue_for_user(
                db,
                user_id=shop.owner_id,
                kind=NotificationKind.DAILY_SUMMARY.value,
                payload=summary,
                dedup_key=f"shop:{shop.id}:daily:{today.isoformat()}",
            )
        await db.commit()


async def _build_summary(
    db: AsyncSession, *, shop_id: int, today: date
) -> dict:
    rows = (
        await db.execute(
            select(InstallmentPayment)
            .join(
                InstallmentPlan, InstallmentPlan.id == InstallmentPayment.plan_id
            )
            .where(
                InstallmentPlan.shop_id == shop_id,
                InstallmentPayment.status.in_(
                    (
                        PaymentStatus.PENDING.value,
                        PaymentStatus.PARTIAL.value,
                        PaymentStatus.OVERDUE.value,
                    )
                ),
            )
        )
    ).scalars().all()

    payments_today = [p for p in rows if p.due_date == today]
    overdue = [p for p in rows if p.due_date < today]

    total_due = sum(
        ((p.amount_due - p.amount_paid) for p in payments_today),
        start=Decimal("0"),
    )

    return {
        "payments_count": len(payments_today),
        "total_due": str(total_due),
        "overdue_count": len(overdue),
    }


# ─── Job: hourly — promote due payments to overdue + enqueue alerts ────


async def _check_overdue() -> None:
    async with SessionFactory() as db:
        today = today_tashkent()
        candidates = await plan_repo.list_due_today_or_overdue(db, today=today)

        for payment in candidates:
            plan = await db.get(InstallmentPlan, payment.plan_id)
            if plan is None:
                continue

            sale = await db.get(Sale, plan.sale_id)
            if sale is None:
                continue
            device = await db.get(Device, sale.device_id)
            shop = await db.get(Shop, plan.shop_id)
            if shop is None:
                continue

            is_overdue = payment.due_date < today
            if is_overdue and payment.status != PaymentStatus.OVERDUE.value:
                payment.status = PaymentStatus.OVERDUE.value

            kind = (
                NotificationKind.PAYMENT_OVERDUE.value
                if is_overdue
                else NotificationKind.PAYMENT_DUE_TODAY.value
            )
            dedup = f"payment:{payment.id}:{kind}:{today.isoformat()}"

            remaining = await plan_repo.remaining_balance(db, plan)
            payload = {
                "buyer_name": sale.buyer_name,
                "buyer_phone": sale.buyer_phone,
                "device": f"{device.brand} {device.model}" if device else "—",
                "amount_due": str(payment.amount_due - payment.amount_paid),
                "remaining": str(remaining),
            }

            await notify_service.enqueue_for_user(
                db,
                user_id=shop.owner_id,
                kind=kind,
                payload=payload,
                dedup_key=dedup,
            )

        await db.commit()


# ─── Job: dispatch outbox ──────────────────────────────────────────────


async def _dispatch_notifications() -> None:
    async with SessionFactory() as db:
        await notify_service.dispatch_pending(db)
        await db.commit()


# ─── Job: 09:00 mirror the official CBU USD rate ───────────────────────


async def _refresh_cbu_rate() -> None:
    async with SessionFactory() as db:
        await exchange_service.refresh_cbu_rate(db)
        await db.commit()


# ─── Wiring ────────────────────────────────────────────────────────────


def build_scheduler() -> AsyncIOScheduler:
    """Configure jobs without starting them — caller controls lifecycle."""
    scheduler = AsyncIOScheduler(timezone=TASHKENT)

    scheduler.add_job(
        _send_daily_summaries,
        trigger=CronTrigger(hour=8, minute=0, timezone=TASHKENT),
        id="daily_summary",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        _refresh_cbu_rate,
        trigger=CronTrigger(hour=9, minute=0, timezone=TASHKENT),
        id="refresh_cbu_rate",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        _check_overdue,
        trigger=IntervalTrigger(hours=1),
        id="check_overdue",
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        _dispatch_notifications,
        trigger=IntervalTrigger(seconds=30),
        id="dispatch_notifications",
        max_instances=1,
        coalesce=True,
    )
    return scheduler
