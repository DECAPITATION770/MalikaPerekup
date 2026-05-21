"""HTTP endpoints for purchases."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.common.pagination import Page, PageParams
from app.common.storage import build_upload_key, presigned_put_url
from app.core.deps import CurrentShop, CurrentUser, DbSession
from app.features.devices import service as device_service
from app.features.devices.schemas import DeviceOut
from app.features.purchases import repository as repo
from app.features.purchases import service
from app.features.purchases.schemas import (
    AddPhotosRequest,
    LastPurchaseDeviceTemplate,
    LastPurchaseSellerTemplate,
    LastPurchaseTemplate,
    PurchaseCreate,
    PurchaseOut,
    PurchaseUpdate,
    PurchaseWithDeviceOut,
)


class UploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=120)


class UploadUrlResponse(BaseModel):
    url: str
    key: str

router = APIRouter(prefix="/purchases", tags=["purchases"])


@router.post(
    "",
    response_model=PurchaseWithDeviceOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_purchase(
    payload: PurchaseCreate,
    shop: CurrentShop,
    user: CurrentUser,
    db: DbSession,
) -> PurchaseWithDeviceOut:
    """Register a new purchase: creates the device and links the seller."""
    try:
        purchase, device = await service.create_purchase(
            db,
            shop_id=shop.id,
            user_id=user.id,
            device_in=payload.device,
            seller_in=payload.seller,
            currency=payload.currency,
            price=payload.price,
            exchange_rate=payload.exchange_rate,
            purchase_date=payload.purchase_date,
            comment=payload.comment,
        )
    except device_service.ImeiAlreadyExists as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except service.PurchaseError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    return PurchaseWithDeviceOut(
        **PurchaseOut.model_validate(purchase).model_dump(),
        device=DeviceOut.model_validate(device),
    )


@router.post("/upload-url", response_model=UploadUrlResponse)
async def request_upload_url(
    payload: UploadUrlRequest, shop: CurrentShop
) -> UploadUrlResponse:
    """Sign a short-lived PUT URL so the Mini App uploads the file directly
    to MinIO/R2 — keeps PII off the API server. Returns the storage key
    to send back via ``POST /{id}/photos`` or inside ``seller.photos`` on
    purchase creation."""
    key = build_upload_key(shop.id, "purchases", payload.filename)
    return UploadUrlResponse(url=presigned_put_url(key), key=key)


# Declared before ``/{purchase_id}`` so the int converter doesn't swallow ``/last``.
@router.get("/last", response_model=LastPurchaseTemplate)
async def get_last_template(
    shop: CurrentShop, db: DbSession
) -> LastPurchaseTemplate:
    """Most recent purchase as a template for the wizard's "🔁 Повторить" card.

    Empty shop → 404 (frontend hides the card). IMEI/serial/price are not
    returned — they must be re-entered for each new physical unit.
    """
    row = await repo.get_last_with_device(db, shop_id=shop.id)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no purchases yet")
    purchase, device = row
    return LastPurchaseTemplate(
        device=LastPurchaseDeviceTemplate(
            category=device.category,
            brand=device.brand,
            model=device.model,
            condition=device.condition,
            specs=device.specs,
            defects=device.defects,
        ),
        seller=LastPurchaseSellerTemplate(
            counterparty_id=purchase.counterparty_id,
            full_name=purchase.seller_name,
            phone=purchase.seller_phone,
            doc_type=purchase.seller_doc_type,
            doc_number=purchase.seller_doc_number,
            tg_username=None,  # not stored on the purchase snapshot
        ),
    )


@router.get("", response_model=Page[PurchaseOut])
async def list_purchases(
    shop: CurrentShop,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    counterparty_id: Annotated[int | None, Query()] = None,
) -> Page[PurchaseOut]:
    """List purchases with date range and counterparty filters."""
    rows, total = await repo.search(
        db,
        shop_id=shop.id,
        date_from=date_from,
        date_to=date_to,
        counterparty_id=counterparty_id,
        limit=params.limit,
        offset=params.offset,
    )
    return Page.of(
        items=[
            PurchaseOut.model_validate(purchase).model_copy(update={
                "device_brand": brand,
                "device_model": model,
                "device_imei": imei,
                "device_category": category,
            })
            for purchase, brand, model, imei, category in rows
        ],
        total=total,
        params=params,
    )


@router.get("/{purchase_id}", response_model=PurchaseOut)
async def get_purchase(
    purchase_id: int, shop: CurrentShop, db: DbSession
) -> PurchaseOut:
    try:
        purchase = await service.get_or_404(db, purchase_id, shop_id=shop.id)
    except service.PurchaseNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return PurchaseOut.model_validate(purchase)


@router.get("/by-device/{device_id}", response_model=PurchaseOut)
async def get_purchase_by_device(
    device_id: int, shop: CurrentShop, db: DbSession
) -> PurchaseOut:
    """Used by the device card to render the purchase block."""
    purchase = await repo.get_by_device(db, device_id, shop_id=shop.id)
    if purchase is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "purchase not found")
    return PurchaseOut.model_validate(purchase)


@router.patch("/{purchase_id}", response_model=PurchaseOut)
async def update_purchase(
    purchase_id: int,
    payload: PurchaseUpdate,
    shop: CurrentShop,
    db: DbSession,
) -> PurchaseOut:
    """Edit purchase fields. Allowed for 24h after creation."""
    try:
        purchase = await service.get_or_404(db, purchase_id, shop_id=shop.id)
    except service.PurchaseNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    try:
        purchase = await service.update(
            db, purchase, **payload.model_dump(exclude_unset=True)
        )
    except service.EditWindowExpired as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    return PurchaseOut.model_validate(purchase)


@router.post("/{purchase_id}/photos", response_model=PurchaseOut)
async def add_seller_photos(
    purchase_id: int,
    payload: AddPhotosRequest,
    shop: CurrentShop,
    db: DbSession,
) -> PurchaseOut:
    """Append seller-document photos uploaded separately to S3.

    The Mini App uploads the file directly to MinIO via a presigned URL
    and then sends the resulting object key here to attach it.
    """
    try:
        purchase = await service.get_or_404(db, purchase_id, shop_id=shop.id)
    except service.PurchaseNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    purchase = await service.add_photos(purchase, payload.photos)
    return PurchaseOut.model_validate(purchase)
