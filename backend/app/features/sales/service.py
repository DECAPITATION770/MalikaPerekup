"""Sale business logic — selling, returning, and pinning profit.

Selling a device performs three coupled actions in one transaction:

1. compute the canonical sale-price triple (UZS / USD / rate);
2. snapshot the original purchase price and compute profit;
3. flip the device status from ``in_stock`` to ``sold``.

Anything that goes wrong inside the call rolls everything back via the
session's commit-or-rollback contract in ``get_db``.
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.common.money import Currency, quantize, to_uzs
from app.features.counterparties import service as counterparty_service
from app.features.devices import service as device_service
from app.features.devices.models import Device, DeviceStatus
from app.features.purchases import repository as purchase_repo
from app.features.sales import repository as repo
from app.features.sales.models import Sale, SaleStatus, SaleType
from app.features.sales.profit_calc import compute_profit

EDIT_WINDOW = timedelta(hours=24)


class SaleError(Exception):
    """Service-level errors mapped to HTTP by the router."""


class SaleNotFound(SaleError):
    pass


class DeviceNotSellable(SaleError):
    """Tried to sell a device that is not currently ``in_stock``."""


class PurchaseMissing(SaleError):
    """Sanity check: every device must have a purchase row to derive profit."""


class EditWindowExpired(SaleError):
    pass


class IllegalReturn(SaleError):
    """Tried to return a sale that is not currently active."""


# ─── Money normalisation (mirrors purchases.service) ──────────────────


def _normalise_money(
    currency: str, price: Decimal, exchange_rate: Decimal | None
) -> tuple[Decimal, Decimal | None, Decimal | None]:
    cur = Currency(currency)
    if cur is Currency.UZS:
        return quantize(price, Currency.UZS), None, None
    if exchange_rate is None:  # caught by Pydantic, defensive guard
        raise SaleError("exchange_rate is required for USD sales")
    price_usd = quantize(price, Currency.USD)
    price_uzs = to_uzs(price_usd, Currency.USD, exchange_rate)
    return price_uzs, price_usd, exchange_rate


# ─── Create ────────────────────────────────────────────────────────────


async def create_sale(
    db: AsyncSession,
    *,
    shop_id: int,
    user_id: int,
    device_id: int,
    buyer_in,             # sales.schemas.BuyerOnSale
    sale_type: str,
    currency: str,
    price: Decimal,
    exchange_rate: Decimal | None,
    sale_date: date,
    comment: str | None,
) -> tuple[Sale, Device]:
    """Sell a device. Pins profit and moves the device to ``sold``."""
    # 1. Load and validate the device.
    device = await device_service.get_or_404(db, device_id, shop_id=shop_id)
    if device.status != DeviceStatus.IN_STOCK.value:
        raise DeviceNotSellable(
            f"device must be in_stock to sell (currently: {device.status})"
        )

    # 2. Recover the original purchase price for the profit snapshot.
    purchase = await purchase_repo.get_by_device(db, device.id, shop_id=shop_id)
    if purchase is None:
        # Should never happen — devices are always created with a purchase.
        raise PurchaseMissing("no purchase record found for this device")

    # 3. Normalise money and compute profit.
    sale_price_uzs, sale_price_usd, rate = _normalise_money(
        currency, price, exchange_rate
    )
    profit = compute_profit(
        sale_price_uzs=sale_price_uzs,
        purchase_price_uzs=purchase.price_uzs,
    )

    # 4. Resolve buyer counterparty (auto-promotes seller→both if applicable).
    counterparty = await counterparty_service.upsert_for_deal(
        db,
        shop_id=shop_id,
        role="buyer",
        full_name=buyer_in.full_name,
        phone=buyer_in.phone,
        doc_type=buyer_in.doc_type,
        doc_number=buyer_in.doc_number,
        doc_photos=buyer_in.photos,
        tg_username=buyer_in.tg_username,
    )

    # 5. Persist the sale row.
    sale = Sale(
        shop_id=shop_id,
        device_id=device.id,
        counterparty_id=counterparty.id,
        buyer_name=buyer_in.full_name,
        buyer_phone=buyer_in.phone,
        buyer_doc_type=buyer_in.doc_type,
        buyer_doc_number=buyer_in.doc_number,
        buyer_photos=list(buyer_in.photos),
        sale_type=sale_type,
        currency=currency,
        sale_price_uzs=sale_price_uzs,
        sale_price_usd=sale_price_usd,
        exchange_rate=rate,
        profit_uzs=profit,
        purchase_price_uzs_snapshot=purchase.price_uzs,
        sale_date=sale_date,
        comment=comment,
        status=SaleStatus.ACTIVE.value,
        created_by=user_id,
    )
    sale = await repo.add(db, sale)

    # 6. Flip device status atomically with the sale insert.
    device_service.transition_status(device, DeviceStatus.SOLD.value)

    return sale, device


# ─── Read / mutate ─────────────────────────────────────────────────────


async def get_or_404(db: AsyncSession, sale_id: int, *, shop_id: int) -> Sale:
    sale = await repo.get_by_id(db, sale_id, shop_id=shop_id)
    if sale is None:
        raise SaleNotFound("sale not found")
    return sale


def _is_within_edit_window(sale: Sale) -> bool:
    return now_utc() - sale.created_at <= EDIT_WINDOW


async def update(db: AsyncSession, sale: Sale, **patch) -> Sale:
    """Edit buyer / date / comment within the 24-hour window."""
    if not _is_within_edit_window(sale) and any(v is not None for v in patch.values()):
        raise EditWindowExpired(
            "sale is older than 24 hours — cancel and re-create instead"
        )
    for field, value in patch.items():
        if value is not None:
            setattr(sale, field, value)
    return sale


async def add_photos(sale: Sale, keys: list[str]) -> Sale:
    """Append buyer-document photos uploaded via presigned URL."""
    sale.buyer_photos = [*sale.buyer_photos, *keys]
    return sale


# ─── Return ────────────────────────────────────────────────────────────


async def return_sale(db: AsyncSession, sale: Sale, *, reason: str | None) -> Sale:
    """Buyer brought the device back. Device returns to ``in_stock`` (via returned).

    If the sale was a nasiya deal, the linked installment plan is cancelled
    in the same transaction — no further dues, no overdue notifications.
    """
    if sale.status != SaleStatus.ACTIVE.value:
        raise IllegalReturn(f"only active sales can be returned (status: {sale.status})")

    sale.status = SaleStatus.RETURNED.value
    sale.return_reason = reason
    sale.returned_at = now_utc()

    device = await device_service.get_or_404(db, sale.device_id, shop_id=sale.shop_id)
    # in_stock cannot be reached directly from sold — go through returned.
    device_service.transition_status(device, DeviceStatus.RETURNED.value)
    device_service.transition_status(device, DeviceStatus.IN_STOCK.value)

    # Stop any nasiya schedule attached to this sale.
    if sale.sale_type == SaleType.NASIYA.value:
        # Local import: installments depends on sales (for sale lookups in
        # router), so importing it here keeps module import order acyclic.
        from app.features.installments import repository as plan_repo
        from app.features.installments import service as plan_service

        plan = await plan_repo.get_plan_for_sale(db, sale.id, shop_id=sale.shop_id)
        if plan is not None and plan.status not in ("completed", "cancelled"):
            await plan_service.cancel_plan(plan, reason=reason)

    return sale
