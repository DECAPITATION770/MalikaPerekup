"""Counterparty notes — list / create / delete with shop-id enforcement.

Kept in a separate module from :mod:`service` so the notes feature can grow
its own behaviours (e.g. auto-system-notes on purchase/sale) without
bloating the core counterparty service.
"""

from __future__ import annotations

from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.counterparties import service as cp_service
from app.features.counterparties.notes_model import (
    CounterpartyNote,
    CounterpartyNoteKind,
)


# Small inline UZS formatter — the frontend has fmt.ts for the same job, but
# the backend has no money formatter (CLAUDE.md §9 only requires Decimal
# transit, not display rendering). System-note bodies are RU-only by design:
# the strings are domain shorthand («Куплено …»), not user-facing copy that
# needs i18n. UZ users in the Tashkent market read RU script fluently.
def _fmt_uzs(value: Decimal | int | None) -> str:
    if value is None:
        return "0"
    n = int(value)
    # Narrow no-break space groups every three digits, matching the frontend.
    return f"{n:,}".replace(",", " ")


async def list_notes(
    db: AsyncSession,
    *,
    shop_id: int,
    counterparty_id: int,
) -> list[CounterpartyNote]:
    """All notes for a counterparty, newest first. Shop-id is the leading
    filter — the index covers this exact ORDER BY."""
    # Existence check piggybacks on the shop guard inside get_or_404 —
    # foreign / cross-shop counterparty_id returns 404 here, not an empty list.
    await cp_service.get_or_404(db, counterparty_id, shop_id=shop_id)
    stmt = (
        select(CounterpartyNote)
        .where(
            and_(
                CounterpartyNote.shop_id == shop_id,
                CounterpartyNote.counterparty_id == counterparty_id,
            )
        )
        .order_by(CounterpartyNote.created_at.desc())
    )
    return list((await db.execute(stmt)).scalars().all())


async def create_note(
    db: AsyncSession,
    *,
    shop_id: int,
    user_id: int,
    counterparty_id: int,
    body: str,
    kind: str = CounterpartyNoteKind.OTHER.value,
) -> CounterpartyNote:
    """Append a user-typed note. Owner shop is validated first so a foreign
    counterparty_id can't be used as a write probe."""
    await cp_service.get_or_404(db, counterparty_id, shop_id=shop_id)
    note = CounterpartyNote(
        shop_id=shop_id,
        counterparty_id=counterparty_id,
        kind=kind,
        body=body.strip(),
        created_by=user_id,
    )
    db.add(note)
    await db.flush()
    return note


async def delete_note(
    db: AsyncSession,
    *,
    shop_id: int,
    note_id: int,
) -> None:
    """Hard delete. Notes are append-only by convention but the user owns
    their data — deleting one is allowed (no audit trail in v1)."""
    note = (
        await db.execute(
            select(CounterpartyNote).where(
                and_(
                    CounterpartyNote.id == note_id,
                    CounterpartyNote.shop_id == shop_id,
                )
            )
        )
    ).scalar_one_or_none()
    if note is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Note not found")
    await db.delete(note)
    await db.flush()


async def auto_note_purchase(
    db: AsyncSession,
    *,
    shop_id: int,
    user_id: int,
    counterparty_id: int,
    device_brand: str,
    device_model: str,
    price_uzs: Decimal,
) -> CounterpartyNote | None:
    """System-note hook called from purchases.service.create_purchase.

    Produces a kind=``system`` note tied to the seller: «Куплено Apple
    iPhone 14 Pro 256GB за 8 500 000 UZS». Lives in the same DB transaction
    as the purchase row — a rollback of the parent rolls the note back too.

    Returns ``None`` when ``counterparty_id`` is missing (anonymous one-off
    sellers — the purchase still gets persisted, just without a note hook).
    """
    if counterparty_id is None:
        return None
    body = f"Куплено {device_brand} {device_model} за {_fmt_uzs(price_uzs)} UZS"
    note = CounterpartyNote(
        shop_id=shop_id,
        counterparty_id=counterparty_id,
        kind=CounterpartyNoteKind.SYSTEM.value,
        body=body,
        created_by=user_id,
    )
    db.add(note)
    await db.flush()
    return note


async def auto_note_sale(
    db: AsyncSession,
    *,
    shop_id: int,
    user_id: int,
    counterparty_id: int | None,
    device_brand: str,
    device_model: str,
    price_uzs: Decimal,
    sale_type: str,
    nasiya_period_count: int | None = None,
) -> CounterpartyNote | None:
    """System-note hook for sales — mirror of :func:`auto_note_purchase`.

    Annotates the body with nasiya period count when applicable so the
    timeline shows «Продано … в рассрочку на 12 месяцев» without the user
    needing to open the deal.
    """
    if counterparty_id is None:
        return None
    suffix = ""
    if sale_type == "nasiya" and nasiya_period_count:
        suffix = f", рассрочка на {nasiya_period_count} платежей"
    body = (
        f"Продано {device_brand} {device_model} за {_fmt_uzs(price_uzs)} UZS"
        f"{suffix}"
    )
    note = CounterpartyNote(
        shop_id=shop_id,
        counterparty_id=counterparty_id,
        kind=CounterpartyNoteKind.SYSTEM.value,
        body=body,
        created_by=user_id,
    )
    db.add(note)
    await db.flush()
    return note


async def pin_counterparty(
    db: AsyncSession,
    *,
    shop_id: int,
    counterparty_id: int,
    pinned: bool,
) -> None:
    """Set the VIP pin flag. Idempotent — pinning an already-pinned row
    succeeds quietly. Returns nothing; the caller refetches to surface
    the new state through the existing CounterpartyOut response."""
    cp = await cp_service.get_or_404(db, counterparty_id, shop_id=shop_id)
    cp.is_pinned = pinned
    await db.flush()
