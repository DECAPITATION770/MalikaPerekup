"""HTTP endpoints for sales."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.common.pagination import Page, PageParams
from app.common.storage import build_upload_key, presigned_put_url
from app.core.deps import CurrentShop, CurrentUser, DbSession
from app.features.devices import service as device_service
from app.features.sales import repository as repo
from app.features.sales import service
from app.features.sales.schemas import (
    AddPhotosRequest,
    ReturnRequest,
    SaleCreate,
    SaleOut,
    SaleStatusLiteral,
    SaleTypeLiteral,
    SaleUpdate,
)


class UploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=120)


class UploadUrlResponse(BaseModel):
    url: str
    key: str


router = APIRouter(prefix="/sales", tags=["sales"])


@router.post("/upload-url", response_model=UploadUrlResponse)
async def request_upload_url(
    payload: UploadUrlRequest, shop: CurrentShop
) -> UploadUrlResponse:
    """Sign a short-lived PUT URL for buyer-document upload (PII off the API)."""
    key = build_upload_key(shop.id, "sales", payload.filename)
    return UploadUrlResponse(url=presigned_put_url(key), key=key)


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
async def create_sale(
    payload: SaleCreate,
    shop: CurrentShop,
    user: CurrentUser,
    db: DbSession,
) -> SaleOut:
    """Sell an in-stock device for cash or nasiya.

    For nasiya, pass ``installment`` to create the sale and its payment
    schedule atomically; omitting it falls back to the legacy two-step flow
    (``POST /sales/{id}/installments``).
    """
    try:
        sale, _ = await service.create_sale(
            db,
            shop_id=shop.id,
            user_id=user.id,
            device_id=payload.device_id,
            buyer_in=payload.buyer,
            sale_type=payload.sale_type,
            currency=payload.currency,
            price=payload.price,
            exchange_rate=payload.exchange_rate,
            sale_date=payload.sale_date,
            comment=payload.comment,
            installment=payload.installment,
        )
    except device_service.DeviceNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    except service.DeviceNotSellable as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    except service.PurchaseMissing as exc:
        # Shouldn't happen in production — surface clearly if it does.
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR, str(exc)
        ) from exc
    except service.SaleError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    return SaleOut.model_validate(sale)


@router.get("", response_model=Page[SaleOut])
async def list_sales(
    shop: CurrentShop,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    date_from: Annotated[date | None, Query(alias="from")] = None,
    date_to: Annotated[date | None, Query(alias="to")] = None,
    sale_type: Annotated[SaleTypeLiteral | None, Query(alias="type")] = None,
    status_: Annotated[SaleStatusLiteral | None, Query(alias="status")] = None,
    counterparty_id: Annotated[int | None, Query()] = None,
) -> Page[SaleOut]:
    rows, total = await repo.search(
        db,
        shop_id=shop.id,
        date_from=date_from,
        date_to=date_to,
        sale_type=sale_type,
        status=status_,
        counterparty_id=counterparty_id,
        limit=params.limit,
        offset=params.offset,
    )
    return Page.of(
        items=[
            SaleOut.model_validate(sale).model_copy(update={
                "device_brand": brand,
                "device_model": model,
                "device_imei": imei,
                "device_category": category,
            })
            for sale, brand, model, imei, category in rows
        ],
        total=total,
        params=params,
    )


@router.get("/{sale_id}", response_model=SaleOut)
async def get_sale(sale_id: int, shop: CurrentShop, db: DbSession) -> SaleOut:
    try:
        sale = await service.get_or_404(db, sale_id, shop_id=shop.id)
    except service.SaleNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return SaleOut.model_validate(sale)


@router.get("/by-device/{device_id}", response_model=list[SaleOut])
async def list_sales_for_device(
    device_id: int, shop: CurrentShop, db: DbSession
) -> list[SaleOut]:
    """All sales for a device (sold → returned → sold-again history)."""
    items = await repo.list_for_device(db, device_id, shop_id=shop.id)
    return [SaleOut.model_validate(it) for it in items]


@router.patch("/{sale_id}", response_model=SaleOut)
async def update_sale(
    sale_id: int,
    payload: SaleUpdate,
    shop: CurrentShop,
    db: DbSession,
) -> SaleOut:
    try:
        sale = await service.get_or_404(db, sale_id, shop_id=shop.id)
    except service.SaleNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    try:
        sale = await service.update(
            db, sale, **payload.model_dump(exclude_unset=True)
        )
    except service.EditWindowExpired as exc:
        raise HTTPException(status.HTTP_403_FORBIDDEN, str(exc)) from exc
    return SaleOut.model_validate(sale)


@router.post("/{sale_id}/photos", response_model=SaleOut)
async def add_buyer_photos(
    sale_id: int, payload: AddPhotosRequest, shop: CurrentShop, db: DbSession
) -> SaleOut:
    try:
        sale = await service.get_or_404(db, sale_id, shop_id=shop.id)
    except service.SaleNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    sale = await service.add_photos(sale, payload.photos)
    return SaleOut.model_validate(sale)


@router.post("/{sale_id}/return", response_model=SaleOut)
async def return_sale(
    sale_id: int, payload: ReturnRequest, shop: CurrentShop, db: DbSession
) -> SaleOut:
    """Process a buyer return — flips device back to in_stock."""
    try:
        sale = await service.get_or_404(db, sale_id, shop_id=shop.id)
    except service.SaleNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    try:
        sale = await service.return_sale(db, sale, reason=payload.reason)
    except service.IllegalReturn as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    return SaleOut.model_validate(sale)
