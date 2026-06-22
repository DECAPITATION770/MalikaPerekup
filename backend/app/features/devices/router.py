"""HTTP endpoints for the devices catalogue.

Devices are NOT created via this router — that happens inside
``POST /purchases``. Here we only list, search, view, edit, and serve QR PNG.
"""

from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from app.common.pagination import Page, PageParams
from app.common.qr import render_qr_png
from app.common.storage import build_upload_key, presigned_put_url, presigned_url
from app.core.deps import CurrentShop, DbSession
from app.features.devices import repository as repo
from app.features.devices import service
from app.features.devices.schemas import (
    DeviceCategoryLiteral,
    DeviceConditionLiteral,
    DeviceOut,
    DeviceStatusLiteral,
    DeviceUpdate,
    DeviceWithPurchaseOut,
    ImeiCheckOut,
    PriceHintOut,
    RecentModelOut,
    RecentModelsOut,
    SuggestOut,
)
from app.features.purchases import repository as purchases_repo


def _parse_money(raw: str | None) -> Decimal | None:
    """Parse a money query-param to Decimal; ignore blanks / garbage."""
    if raw is None or raw.strip() == "":
        return None
    try:
        return Decimal(raw.replace(" ", ""))
    except InvalidOperation:
        return None


class _UploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=120)


class _UploadUrlResponse(BaseModel):
    url: str
    key: str


class _PhotoUrlsResponse(BaseModel):
    """Short-lived signed GET URLs for a device's photos, in stored order."""

    urls: list[str]


router = APIRouter(prefix="/devices", tags=["devices"])


# Single-segment path, declared before ``/{device_id}`` for the same reason
# the suggestion endpoints are.
@router.post("/upload-url", response_model=_UploadUrlResponse)
async def request_device_upload_url(
    payload: _UploadUrlRequest, shop: CurrentShop
) -> _UploadUrlResponse:
    """Sign a short-lived PUT URL for a device photo (front/back/defect).

    Mirrors ``POST /purchases/upload-url`` but uses scope ``devices`` so
    photos land in ``shops/{id}/devices/...`` — keeps them separate from
    seller-document photos for clean cascaded delete when a device is removed.
    """
    key = build_upload_key(shop.id, "devices", payload.filename)
    return _UploadUrlResponse(url=presigned_put_url(key), key=key)


@router.get("", response_model=Page[DeviceWithPurchaseOut])
async def list_devices(
    shop: CurrentShop,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    q: Annotated[str | None, Query(description="search IMEI / serial / brand / model")] = None,
    status_: Annotated[DeviceStatusLiteral | None, Query(alias="status")] = None,
    category: Annotated[DeviceCategoryLiteral | None, Query()] = None,
    condition: Annotated[DeviceConditionLiteral | None, Query()] = None,
    brand: Annotated[str | None, Query(max_length=64)] = None,
    price_min: Annotated[str | None, Query()] = None,
    price_max: Annotated[str | None, Query()] = None,
    sort: Annotated[
        Literal["recent", "days", "price_asc", "price_desc"], Query()
    ] = "recent",
) -> Page[DeviceWithPurchaseOut]:
    """Витрина: filter by status / category / condition / brand / price + sort.

    Returns purchase price + days-in-stock joined per row so the Stock table
    renders one row per device with all the columns the user expects to see.
    """
    from datetime import datetime, timezone  # local — only used here

    # UTC for both sides so a deploy on Asia/Tashkent isn't off by one.
    today_utc = datetime.now(tz=timezone.utc).date()
    rows, total = await repo.search_with_purchase(
        db,
        shop_id=shop.id,
        query=q,
        status=status_,
        category=category,
        condition=condition,
        brand=brand,
        price_min=_parse_money(price_min),
        price_max=_parse_money(price_max),
        sort=sort,
        limit=params.limit,
        offset=params.offset,
    )
    items: list[DeviceWithPurchaseOut] = []
    for device, price_uzs, purchase_date in rows:
        base = DeviceOut.model_validate(device).model_dump()
        items.append(
            DeviceWithPurchaseOut(
                **base,
                purchase_price_uzs=str(price_uzs) if price_uzs is not None else None,
                purchase_date=purchase_date,
                days_in_stock=(today_utc - device.created_at.astimezone(timezone.utc).date()).days,
                # Sign only the first photo — list rows show one thumbnail.
                photo_url=presigned_url(device.photos[0]) if device.photos else None,
            )
        )
    return Page.of(items=items, total=total, params=params)


# Declared before ``/{device_id}`` so the int path converter doesn't
# swallow ``/devices/suggestions``.
@router.get("/suggestions", response_model=SuggestOut)
async def suggestions(
    shop: CurrentShop,
    db: DbSession,
    field: Annotated[Literal["brand", "model"], Query()],
    q: Annotated[str, Query(max_length=120)] = "",
    brand: Annotated[str | None, Query(max_length=64)] = None,
    # le=200 (was 20): the Stock brand filter requests the full popularity-
    # ordered list so its «show all» toggle reveals every brand, not just 20.
    # The purchase-form autocomplete still passes its own small limit.
    limit: Annotated[int, Query(ge=1, le=200)] = 8,
) -> SuggestOut:
    """Autocomplete for the purchase form's brand/model fields — distinct
    values from THIS shop's own device history, most-used first."""
    values = await repo.suggest(
        db, shop_id=shop.id, field=field, q=q.strip(), brand=brand, limit=limit
    )
    return SuggestOut(values=values)


# Before ``/{device_id}`` so the int converter doesn't swallow this path.
@router.get("/recent-models", response_model=RecentModelsOut)
async def recent_models(
    shop: CurrentShop,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=20)] = 10,
) -> RecentModelsOut:
    """Most-recent distinct (brand, model, category) triples from this shop.

    Step 1 of the purchase wizard renders one chip per item. Empty list is
    a valid first-use state — the wizard then falls back to the "+ другая
    модель" free-text fields.
    """
    rows = await repo.recent_models(db, shop_id=shop.id, limit=limit)
    return RecentModelsOut(
        items=[
            RecentModelOut(brand=b, model=m, category=c) for b, m, c in rows
        ]
    )


# Before ``/{device_id}`` — single-segment path under int converter.
@router.get("/price-hint", response_model=PriceHintOut)
async def price_hint(
    shop: CurrentShop,
    db: DbSession,
    brand: Annotated[str, Query(min_length=1, max_length=64)],
    model: Annotated[str, Query(min_length=1, max_length=120)],
) -> PriceHintOut:
    """Past purchase prices for this brand+model — "is 4.0M normal?"

    Step 4 of the wizard shows a one-line hint under the price input.
    All amounts are in UZS (USD deals are pre-converted at deal time).
    """
    count, last, avg = await purchases_repo.price_hint(
        db, shop_id=shop.id, brand=brand, model=model
    )
    return PriceHintOut(
        count=count,
        last_price_uzs=str(last) if last is not None else None,
        avg_price_uzs=str(avg) if avg is not None else None,
    )


# Also before ``/{device_id}`` (single segment → int converter would grab it).
@router.get("/imei-check", response_model=ImeiCheckOut)
async def imei_check(
    shop: CurrentShop,
    db: DbSession,
    imei: Annotated[str, Query(min_length=14, max_length=32)],
) -> ImeiCheckOut:
    """Soft duplicate check while typing IMEI on the purchase form.

    Returns whether this exact unit (any status, even ``sold``) is already
    in THIS shop, plus the original purchase date and seller so the user
    recognises a returning device. Non-blocking — create still 409s on a
    real ``in_stock`` duplicate.
    """
    device = await repo.get_by_imei(db, imei, shop_id=shop.id)
    if device is None:
        return ImeiCheckOut(found=False)

    purchase = await purchases_repo.get_by_device(
        db, device.id, shop_id=shop.id
    )
    return ImeiCheckOut(
        found=True,
        status=device.status,
        brand=device.brand,
        model=device.model,
        purchase_date=purchase.purchase_date if purchase else None,
        seller_name=purchase.seller_name if purchase else None,
    )


@router.get("/{device_id}", response_model=DeviceOut)
async def get_device(device_id: int, shop: CurrentShop, db: DbSession) -> DeviceOut:
    try:
        device = await service.get_or_404(db, device_id, shop_id=shop.id)
    except service.DeviceNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return DeviceOut.model_validate(device)


@router.get("/{device_id}/photo-urls", response_model=_PhotoUrlsResponse)
async def get_device_photo_urls(
    device_id: int, shop: CurrentShop, db: DbSession
) -> _PhotoUrlsResponse:
    """Sign short-lived GET URLs for this device's photos.

    Photos are stored with a private ACL (CLAUDE.md §10), so the keys on
    ``DeviceOut.photos`` can't be rendered directly — the Mini App calls
    this to get TTL-limited URLs. Shop-scoped via ``get_or_404`` so a
    foreign ``device_id`` returns 404, never another shop's photos.
    """
    try:
        device = await service.get_or_404(db, device_id, shop_id=shop.id)
    except service.DeviceNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return _PhotoUrlsResponse(urls=[presigned_url(key) for key in device.photos])


@router.get("/by-token/{qr_token}", response_model=DeviceOut)
async def get_device_by_token(
    qr_token: str, shop: CurrentShop, db: DbSession
) -> DeviceOut:
    """Resolve a scanned QR sticker to its device card."""
    try:
        device = await service.get_by_token_or_404(db, qr_token, shop_id=shop.id)
    except service.DeviceNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return DeviceOut.model_validate(device)


@router.get(
    "/{device_id}/qr.png",
    responses={200: {"content": {"image/png": {}}}},
    response_class=Response,
)
async def get_device_qr_png(
    device_id: int, shop: CurrentShop, db: DbSession
) -> Response:
    """Return the QR sticker as a printable PNG."""
    try:
        device = await service.get_or_404(db, device_id, shop_id=shop.id)
    except service.DeviceNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return Response(
        content=render_qr_png(device.qr_token),
        media_type="image/png",
        # ``inline`` so it shows in the Mini App; switch to "attachment" if
        # the print flow ever wants a forced download.
        headers={"Content-Disposition": f'inline; filename="device-{device.id}.png"'},
    )


@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(
    device_id: int, payload: DeviceUpdate, shop: CurrentShop, db: DbSession
) -> DeviceOut:
    """Edit device details — full edit within 24h, only notes after."""
    try:
        device = await service.get_or_404(db, device_id, shop_id=shop.id)
    except service.DeviceNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    try:
        device = await service.update(
            db, device, **payload.model_dump(exclude_unset=True)
        )
    except service.EditWindowExpired as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    except service.ImeiAlreadyExists as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return DeviceOut.model_validate(device)
