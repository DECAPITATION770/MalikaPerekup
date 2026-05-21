"""Counterparty business logic.

Handles a few rules that the repository deliberately knows nothing about:
* the ``seller`` / ``buyer`` / ``both`` promotion when a person plays both roles;
* shop ownership checks before mutating or deleting a row.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.features.counterparties import repository as repo
from app.features.counterparties.models import Counterparty


class CounterpartyError(Exception):
    """Service-level errors mapped to HTTP by the router."""


class CounterpartyNotFound(CounterpartyError):
    pass


def _promote_type(current: str, new: str) -> str:
    """Return ``"both"`` if a counterparty plays a role they did not before.

    >>> _promote_type("seller", "buyer")
    'both'
    >>> _promote_type("buyer", "buyer")
    'buyer'
    """
    if current == new:
        return current
    return "both"


async def get_or_404(
    db: AsyncSession, counterparty_id: int, *, shop_id: int
) -> Counterparty:
    """Fetch a counterparty inside the shop or raise."""
    counterparty = await repo.get_by_id(db, counterparty_id, shop_id=shop_id)
    if counterparty is None:
        raise CounterpartyNotFound("counterparty not found")
    return counterparty


async def upsert_for_deal(
    db: AsyncSession,
    *,
    shop_id: int,
    role: str,  # "seller" | "buyer"
    full_name: str,
    phone: str | None,
    doc_type: str | None = None,
    doc_number: str | None = None,
    doc_photos: list[str] | None = None,
    tg_username: str | None = None,
) -> Counterparty:
    """Find by phone or create — used when registering a purchase or sale.

    If a counterparty with the same phone already exists, its ``type`` is
    promoted to ``both`` when the new deal puts them on the opposite side.
    Other fields are filled in only if they were missing — we never
    overwrite data the user already entered for this contact.
    """
    existing = (
        await repo.find_by_phone(db, phone, shop_id=shop_id) if phone else None
    )
    if existing is not None:
        existing.type = _promote_type(existing.type, role)
        if not existing.doc_type and doc_type:
            existing.doc_type = doc_type
        if not existing.doc_number and doc_number:
            existing.doc_number = doc_number
        if doc_photos:
            # Append new photo keys so historical evidence is preserved.
            existing.doc_photos = [*existing.doc_photos, *doc_photos]
        if not existing.tg_username and tg_username:
            existing.tg_username = tg_username
        return existing

    return await repo.create(
        db,
        shop_id=shop_id,
        type=role,
        full_name=full_name,
        phone=phone,
        doc_type=doc_type,
        doc_number=doc_number,
        doc_photos=doc_photos or [],
        tg_username=tg_username,
    )


async def update(
    db: AsyncSession,
    counterparty: Counterparty,
    **patch,
) -> Counterparty:
    """Apply a partial update — only fields that are not ``None`` are touched."""
    for field, value in patch.items():
        if value is not None:
            setattr(counterparty, field, value)
    return counterparty


async def soft_delete(counterparty: Counterparty) -> None:
    """Hide a counterparty without breaking FK from past deals."""
    counterparty.deleted_at = now_utc()
