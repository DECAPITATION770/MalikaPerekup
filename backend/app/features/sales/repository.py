"""Database queries for the ``sales`` table."""

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.devices.models import Device
from app.features.sales.models import Sale, SaleStatus


async def get_by_id(db: AsyncSession, sale_id: int, *, shop_id: int) -> Sale | None:
    result = await db.execute(
        select(Sale).where(Sale.id == sale_id, Sale.shop_id == shop_id)
    )
    return result.scalar_one_or_none()


async def get_active_for_device(
    db: AsyncSession, device_id: int, *, shop_id: int
) -> Sale | None:
    """Return the live (non-cancelled, non-returned) sale for this device, if any."""
    result = await db.execute(
        select(Sale).where(
            Sale.device_id == device_id,
            Sale.shop_id == shop_id,
            Sale.status == SaleStatus.ACTIVE.value,
        )
    )
    return result.scalar_one_or_none()


async def list_for_device(
    db: AsyncSession, device_id: int, *, shop_id: int
) -> list[Sale]:
    """All sale rows for a device — used in the device card history."""
    result = await db.execute(
        select(Sale)
        .where(Sale.device_id == device_id, Sale.shop_id == shop_id)
        .order_by(Sale.created_at.desc())
    )
    return list(result.scalars().all())


async def search(
    db: AsyncSession,
    *,
    shop_id: int,
    date_from: date | None,
    date_to: date | None,
    sale_type: str | None,
    status: str | None,
    counterparty_id: int | None,
    limit: int,
    offset: int,
) -> tuple[list[tuple[Sale, str | None, str | None, str | None, str | None]], int]:
    """List sales joined with device brand/model/imei/category for readable list rows."""
    base = (
        select(
            Sale,
            Device.brand,
            Device.model,
            Device.imei,
            Device.category,
        )
        .join(Device, Device.id == Sale.device_id)
        .where(Sale.shop_id == shop_id)
    )
    if date_from is not None:
        base = base.where(Sale.sale_date >= date_from)
    if date_to is not None:
        base = base.where(Sale.sale_date <= date_to)
    if sale_type:
        base = base.where(Sale.sale_type == sale_type)
    if status:
        base = base.where(Sale.status == status)
    if counterparty_id is not None:
        base = base.where(Sale.counterparty_id == counterparty_id)

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    rows = (
        await db.execute(
            base.order_by(Sale.sale_date.desc(), Sale.id.desc())
            .limit(limit)
            .offset(offset)
        )
    ).all()
    return [(r[0], r[1], r[2], r[3], r[4]) for r in rows], total


async def add(db: AsyncSession, sale: Sale) -> Sale:
    db.add(sale)
    await db.flush()
    return sale
