"""Attachments service — owner validation, presigned URL signing, deletion.

Owner validation lives here (not in the router) because every owner_type
needs a different `SELECT` to confirm both existence and shop_id match.
The router only chooses which validator to call.
"""

from __future__ import annotations

from typing import Iterable

from fastapi import HTTPException, status
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.common import storage
from app.features.attachments.models import (
    Attachment,
    AttachmentKind,
    AttachmentOwnerType,
)
from app.features.attachments.schemas import KindLiteral, OwnerTypeLiteral
from app.features.catalog.models import CatalogModel
from app.features.counterparties.models import Counterparty
from app.features.devices.models import Device
from app.features.installments.models import InstallmentPlan
from app.features.purchases.models import Purchase
from app.features.sales.models import Sale

# ─────────────────────────────────────────────────────────────────────────
# Owner validation — single dispatch table so adding a new owner type is
# one line, not a switch deep inside the router.
# ─────────────────────────────────────────────────────────────────────────

# Each row: (owner_type, ORM model). The shop_id check uses the model's
# own `shop_id` column; every owner type happens to have one because the
# multi-tenant invariant from CLAUDE.md §6 demands it everywhere.
_OWNER_MODELS: dict[str, type] = {
    AttachmentOwnerType.DEVICE.value: Device,
    AttachmentOwnerType.PURCHASE.value: Purchase,
    AttachmentOwnerType.SALE.value: Sale,
    AttachmentOwnerType.COUNTERPARTY.value: Counterparty,
    AttachmentOwnerType.INSTALLMENT.value: InstallmentPlan,
    AttachmentOwnerType.CATALOG_MODEL.value: CatalogModel,
}


async def _assert_owner(
    db: AsyncSession,
    *,
    shop_id: int,
    owner_type: str,
    owner_id: int,
) -> None:
    """404 if the (owner_type, owner_id) pair is missing or belongs to
    another shop. Centralised so every endpoint enforces the same rule."""
    model = _OWNER_MODELS.get(owner_type)
    if model is None:
        # Should be unreachable because the Pydantic Literal blocks bad
        # owner_type values at the FastAPI layer; defensive raise anyway.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Unknown owner_type: {owner_type}"
        )
    stmt = select(model.id).where(
        and_(model.id == owner_id, model.shop_id == shop_id)
    )
    found = (await db.execute(stmt)).scalar_one_or_none()
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Owner not found")


# ─────────────────────────────────────────────────────────────────────────
# Create — sign a presigned PUT and persist the attachment row in one tx.
# ─────────────────────────────────────────────────────────────────────────


async def issue_upload(
    db: AsyncSession,
    *,
    shop_id: int,
    user_id: int,
    owner_type: OwnerTypeLiteral,
    owner_id: int,
    filename: str,
    mime_type: str,
    size_bytes: int,
    kind: KindLiteral,
    note: str | None,
) -> tuple[str, Attachment]:
    """Validate owner, mint a storage key, persist the row, return (PUT URL, row).

    The row is created BEFORE the browser PUTs the bytes. This is a
    deliberate trade-off: an upload that fails to PUT leaves a "phantom"
    DB row pointing at a key that doesn't exist in S3, but the list
    endpoint hides such rows because the presigned-GET 404s cleanly.
    The alternative — confirm-after-upload — needs a separate webhook
    from MinIO/R2 and a job queue, which is out of MVP scope.
    """
    await _assert_owner(
        db, shop_id=shop_id, owner_type=owner_type, owner_id=owner_id
    )
    # Scope segment in the S3 key keeps file paths grouped by owner type —
    # eases manual debugging in MinIO console + future bulk-export jobs.
    s3_key = storage.build_upload_key(shop_id, f"attachments/{owner_type}", filename)
    url = storage.presigned_put_url(s3_key)
    row = Attachment(
        shop_id=shop_id,
        owner_type=owner_type,
        owner_id=owner_id,
        kind=kind,
        s3_key=s3_key,
        original_name=filename,
        mime_type=mime_type,
        size_bytes=size_bytes,
        note=note,
        sort_order=await _next_sort_order(
            db, shop_id=shop_id, owner_type=owner_type, owner_id=owner_id, kind=kind
        ),
        uploaded_by=user_id,
    )
    db.add(row)
    await db.flush()
    return url, row


async def _next_sort_order(
    db: AsyncSession,
    *,
    shop_id: int,
    owner_type: str,
    owner_id: int,
    kind: str,
) -> int:
    """Append-to-end semantics — the next file lands after the current tail."""
    stmt = select(Attachment.sort_order).where(
        and_(
            Attachment.shop_id == shop_id,
            Attachment.owner_type == owner_type,
            Attachment.owner_id == owner_id,
            Attachment.kind == kind,
        )
    )
    rows = (await db.execute(stmt)).scalars().all()
    return (max(rows) + 1) if rows else 0


# ─────────────────────────────────────────────────────────────────────────
# Read — list attachments + a presigned GET per file.
# ─────────────────────────────────────────────────────────────────────────


async def list_for_owner(
    db: AsyncSession,
    *,
    shop_id: int,
    owner_type: OwnerTypeLiteral,
    owner_id: int,
    kind: KindLiteral | None = None,
) -> list[Attachment]:
    """List attachments for one owner; optionally filtered by kind.
    Order: kind alphabetical (stable groups in UI), then sort_order, then upload time."""
    stmt = select(Attachment).where(
        and_(
            Attachment.shop_id == shop_id,
            Attachment.owner_type == owner_type,
            Attachment.owner_id == owner_id,
        )
    )
    if kind is not None:
        stmt = stmt.where(Attachment.kind == kind)
    stmt = stmt.order_by(
        Attachment.kind, Attachment.sort_order, Attachment.uploaded_at
    )
    return list((await db.execute(stmt)).scalars().all())


async def list_for_device(
    db: AsyncSession,
    *,
    shop_id: int,
    device_id: int,
) -> list[Attachment]:
    """Aggregate the full device story: device's own attachments plus its
    purchase's seller docs plus all linked sale rows' buyer docs. Returned
    in chronological order so the StockDetail timeline reads as a story."""
    # Resolve the device's purchase and sale ids first — one round-trip each.
    purchase_id = (
        await db.execute(
            select(Purchase.id).where(
                and_(
                    Purchase.shop_id == shop_id,
                    Purchase.device_id == device_id,
                )
            )
        )
    ).scalar_one_or_none()
    sale_ids = list(
        (
            await db.execute(
                select(Sale.id).where(
                    and_(Sale.shop_id == shop_id, Sale.device_id == device_id)
                )
            )
        )
        .scalars()
        .all()
    )

    # OR over (owner_type, owner_id) combinations — covered by ix_attachments_owner
    # via the leading shop_id prefix; planner picks the index per shop row.
    conditions = [
        and_(
            Attachment.owner_type == AttachmentOwnerType.DEVICE.value,
            Attachment.owner_id == device_id,
        )
    ]
    if purchase_id is not None:
        conditions.append(
            and_(
                Attachment.owner_type == AttachmentOwnerType.PURCHASE.value,
                Attachment.owner_id == purchase_id,
            )
        )
    if sale_ids:
        conditions.append(
            and_(
                Attachment.owner_type == AttachmentOwnerType.SALE.value,
                Attachment.owner_id.in_(sale_ids),
            )
        )
    stmt = (
        select(Attachment)
        .where(and_(Attachment.shop_id == shop_id, or_(*conditions)))
        .order_by(Attachment.uploaded_at)
    )
    return list((await db.execute(stmt)).scalars().all())


def sign_urls(attachments: Iterable[Attachment]) -> dict[int, str]:
    """Mint a fresh presigned GET URL per attachment. Stays out of the DB
    layer so list functions remain easily testable without storage I/O."""
    return {a.id: storage.presigned_url(a.s3_key) for a in attachments}


# ─────────────────────────────────────────────────────────────────────────
# Mutations — patch (caption / order) and delete (DB + S3).
# ─────────────────────────────────────────────────────────────────────────


async def patch(
    db: AsyncSession,
    *,
    shop_id: int,
    attachment_id: int,
    note: str | None,
    sort_order: int | None,
) -> Attachment:
    row = await _get_or_404(db, shop_id=shop_id, attachment_id=attachment_id)
    if note is not None:
        row.note = note
    if sort_order is not None:
        row.sort_order = sort_order
    await db.flush()
    return row


async def remove(
    db: AsyncSession,
    *,
    shop_id: int,
    attachment_id: int,
) -> None:
    """Delete DB row first, then the S3 object. The reverse order would
    leave an unreachable S3 object on DB failure; this order leaves a
    cleanup-job candidate (missing S3 object) which the list endpoint
    tolerates because presigned GET 404s map to a broken-thumbnail in UI."""
    row = await _get_or_404(db, shop_id=shop_id, attachment_id=attachment_id)
    key = row.s3_key
    await db.delete(row)
    await db.flush()
    try:
        storage.delete(key)
    except Exception:  # noqa: BLE001 — best-effort S3 cleanup, do not block delete
        # MinIO transient failures shouldn't roll back the user's intent.
        # A nightly orphan-key cleaner (out of scope here) can sweep these up.
        pass


async def _get_or_404(
    db: AsyncSession,
    *,
    shop_id: int,
    attachment_id: int,
) -> Attachment:
    row = (
        await db.execute(
            select(Attachment).where(
                and_(Attachment.id == attachment_id, Attachment.shop_id == shop_id)
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Attachment not found")
    return row


# Re-exports for callers that don't want to import the enums directly.
KIND_VALUES = {k.value for k in AttachmentKind}
OWNER_TYPE_VALUES = {t.value for t in AttachmentOwnerType}
