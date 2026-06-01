"""Purchase business logic.

This module owns the most important transaction in the system: a single
``create_purchase`` call atomically creates a ``Device``, an optional
``Counterparty`` (or finds an existing one by phone), and the ``Purchase``
that ties them together. If anything fails the whole transaction is
rolled back by FastAPI's ``get_db`` dependency.
"""

from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.common.money import Currency, quantize, to_uzs
from app.features.catalog import service as catalog_service
from app.features.counterparties import notes_service as cp_notes
from app.features.counterparties import service as counterparty_service
from app.features.devices import service as device_service
from app.features.devices.models import Device
from app.features.devices.specs import SpecsValidationError, validate_specs
from app.features.purchases import repository as repo
from app.features.purchases.models import Purchase

EDIT_WINDOW = timedelta(hours=24)


class PurchaseError(Exception):
    """Service-level errors mapped to HTTP by the router."""


class PurchaseNotFound(PurchaseError):
    pass


class EditWindowExpired(PurchaseError):
    pass


# ─── Money normalisation ──────────────────────────────────────────────


def _normalise_money(
    currency: str, price: Decimal, exchange_rate: Decimal | None
) -> tuple[Decimal, Decimal | None, Decimal | None]:
    """Return the canonical ``(price_uzs, price_usd, exchange_rate)`` triple.

    For UZS deals: ``price_usd`` and ``exchange_rate`` stay None.
    For USD deals: ``price_usd`` is the original amount, ``price_uzs`` is
    derived once and stored — never recomputed from a fresh rate later.
    """
    cur = Currency(currency)
    if cur is Currency.UZS:
        return quantize(price, Currency.UZS), None, None

    if exchange_rate is None:  # caught earlier by Pydantic, defensive only
        raise PurchaseError("exchange_rate is required for USD purchases")
    price_usd = quantize(price, Currency.USD)
    price_uzs = to_uzs(price_usd, Currency.USD, exchange_rate)
    return price_uzs, price_usd, exchange_rate


# ─── Create ────────────────────────────────────────────────────────────


async def create_purchase(
    db: AsyncSession,
    *,
    shop_id: int,
    user_id: int,
    device_in,            # purchases.schemas.DeviceOnPurchase
    seller_in,            # purchases.schemas.SellerOnPurchase
    currency: str,
    price: Decimal,
    exchange_rate: Decimal | None,
    purchase_date: date,
    comment: str | None,
) -> tuple[Purchase, Device]:
    """Create a device + counterparty + purchase in one transaction."""
    # 1. Validate specs against the category schema (raises 400 on mismatch).
    try:
        clean_specs = validate_specs(device_in.category, device_in.specs)
    except SpecsValidationError as exc:
        raise PurchaseError(f"invalid specs: {exc}") from exc

    # 2. Build the device (raises ImeiAlreadyExists on duplicate IMEI).
    device = await device_service.create_for_purchase(
        db,
        shop_id=shop_id,
        created_by=user_id,
        category=device_in.category,
        brand=device_in.brand,
        model=device_in.model,
        imei=device_in.imei,
        serial=device_in.serial,
        condition=device_in.condition,
        specs=clean_specs,
        photos=device_in.photos,
        defects=device_in.defects,
        notes=device_in.notes,
    )

    # 2b. Refresh the shop's catalog template for this model so the next
    # purchase of the same model pre-fills specs + photo (CLAUDE.md §15).
    await catalog_service.upsert_for_purchase(
        db,
        shop_id=shop_id,
        category=device_in.category,
        brand=device_in.brand,
        model=device_in.model,
        specs=clean_specs,
        photos=device_in.photos,
    )

    # 2. Resolve the seller via the directory (find by phone or create new).
    counterparty = await counterparty_service.upsert_for_deal(
        db,
        shop_id=shop_id,
        role="seller",
        full_name=seller_in.full_name,
        phone=seller_in.phone,
        doc_type=seller_in.doc_type,
        doc_number=seller_in.doc_number,
        doc_photos=seller_in.photos,
        tg_username=seller_in.tg_username,
    )

    # 3. Compute the canonical money fields.
    price_uzs, price_usd, rate = _normalise_money(currency, price, exchange_rate)

    # 4. Persist the purchase row.
    purchase = Purchase(
        shop_id=shop_id,
        device_id=device.id,
        counterparty_id=counterparty.id,
        seller_name=seller_in.full_name,
        seller_phone=seller_in.phone,
        seller_doc_type=seller_in.doc_type,
        seller_doc_number=seller_in.doc_number,
        seller_photos=list(seller_in.photos),
        currency=currency,
        price_uzs=price_uzs,
        price_usd=price_usd,
        exchange_rate=rate,
        purchase_date=purchase_date,
        comment=comment,
        created_by=user_id,
    )
    stored = await repo.add(db, purchase)

    # Auto-system-note on the seller's counterparty so the directory shows
    # «Куплено Apple iPhone 14 Pro 256GB за 8 500 000 UZS» without anyone
    # typing. Lives in the same transaction; if the parent rolls back so
    # does the note. Catch & swallow note errors — a flaky note is never
    # worth blocking a real purchase from being recorded.
    try:
        await cp_notes.auto_note_purchase(
            db,
            shop_id=shop_id,
            user_id=user_id,
            counterparty_id=counterparty.id,
            device_brand=device_in.brand,
            device_model=device_in.model,
            price_uzs=price_uzs,
        )
    except Exception:  # noqa: BLE001 — note write is best-effort
        pass

    return stored, device


# ─── Read / mutate ─────────────────────────────────────────────────────


async def get_or_404(db: AsyncSession, purchase_id: int, *, shop_id: int) -> Purchase:
    purchase = await repo.get_by_id(db, purchase_id, shop_id=shop_id)
    if purchase is None:
        raise PurchaseNotFound("purchase not found")
    return purchase


def _is_within_edit_window(purchase: Purchase) -> bool:
    return now_utc() - purchase.created_at <= EDIT_WINDOW


async def update(
    db: AsyncSession,
    purchase: Purchase,
    **patch,
) -> Purchase:
    """Apply a partial update with the 24-hour rule.

    Outside the window all writes are rejected: a corrected purchase older
    than a day must instead be cancelled and re-entered (auditable trail).
    """
    if not _is_within_edit_window(purchase) and any(v is not None for v in patch.values()):
        raise EditWindowExpired(
            "purchase is older than 24 hours — fix via cancel + re-create"
        )

    # Money fields are linked: changing any one re-runs the normaliser so
    # ``price_uzs`` and ``price_usd`` stay consistent.
    money_keys = {"currency", "price", "exchange_rate"}
    if money_keys & {k for k, v in patch.items() if v is not None}:
        currency = patch.get("currency") or purchase.currency
        price = patch.get("price")
        if price is None:
            price = (
                purchase.price_usd
                if currency == Currency.USD.value and purchase.price_usd is not None
                else purchase.price_uzs
            )
        rate = patch.get("exchange_rate") or purchase.exchange_rate
        purchase.price_uzs, purchase.price_usd, purchase.exchange_rate = _normalise_money(
            currency, price, rate
        )
        purchase.currency = currency

    for field, value in patch.items():
        if value is None or field in money_keys:
            continue
        setattr(purchase, field, value)

    return purchase


async def add_photos(purchase: Purchase, keys: list[str]) -> Purchase:
    """Append uploaded S3 keys to ``seller_photos`` — even after edit window."""
    purchase.seller_photos = [*purchase.seller_photos, *keys]
    return purchase
