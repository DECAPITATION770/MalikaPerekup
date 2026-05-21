"""HTTP endpoints for the counterparties directory."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.common.pagination import Page, PageParams
from app.core.deps import CurrentShop, DbSession
from app.features.counterparties import repository as repo
from app.features.counterparties import service
from app.features.counterparties.schemas import (
    CounterpartyCreate,
    CounterpartyDealsOut,
    CounterpartyOut,
    CounterpartyType,
    CounterpartyUpdate,
)
from app.features.purchases import repository as purchase_repo
from app.features.purchases.schemas import PurchaseOut
from app.features.sales import repository as sale_repo
from app.features.sales.schemas import SaleOut

router = APIRouter(prefix="/counterparties", tags=["counterparties"])


@router.get("", response_model=Page[CounterpartyOut])
async def list_counterparties(
    shop: CurrentShop,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    q: Annotated[str | None, Query(description="search by name or phone")] = None,
    type_: Annotated[
        CounterpartyType | None,
        Query(alias="type", description="filter by role"),
    ] = None,
) -> Page[CounterpartyOut]:
    """Search the directory — used by the autocomplete in purchase/sale forms."""
    items, total = await repo.search(
        db,
        shop_id=shop.id,
        query=q,
        type_=type_,
        limit=params.limit,
        offset=params.offset,
    )
    return Page.of(
        items=[CounterpartyOut.model_validate(it) for it in items],
        total=total,
        params=params,
    )


@router.post(
    "", response_model=CounterpartyOut, status_code=status.HTTP_201_CREATED
)
async def create_counterparty(
    payload: CounterpartyCreate, shop: CurrentShop, db: DbSession
) -> CounterpartyOut:
    """Manually add a counterparty from the directory screen."""
    counterparty = await repo.create(
        db, shop_id=shop.id, **payload.model_dump()
    )
    return CounterpartyOut.model_validate(counterparty)


@router.get("/{counterparty_id}", response_model=CounterpartyOut)
async def get_counterparty(
    counterparty_id: int, shop: CurrentShop, db: DbSession
) -> CounterpartyOut:
    try:
        counterparty = await service.get_or_404(
            db, counterparty_id, shop_id=shop.id
        )
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return CounterpartyOut.model_validate(counterparty)


@router.get("/{counterparty_id}/deals", response_model=CounterpartyDealsOut)
async def get_counterparty_deals(
    counterparty_id: int, shop: CurrentShop, db: DbSession
) -> CounterpartyDealsOut:
    """Full deal history for one counterparty — every purchase from them
    and every sale to them, joined with device labels for readability.
    Powers the counterparty detail page (`/counterparties/:id`)."""
    try:
        counterparty = await service.get_or_404(
            db, counterparty_id, shop_id=shop.id
        )
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    purchase_rows, _ = await purchase_repo.search(
        db,
        shop_id=shop.id,
        date_from=None, date_to=None,
        counterparty_id=counterparty_id,
        limit=200, offset=0,
    )
    sale_rows, _ = await sale_repo.search(
        db,
        shop_id=shop.id,
        date_from=None, date_to=None,
        sale_type=None, status=None,
        counterparty_id=counterparty_id,
        limit=200, offset=0,
    )

    purchases = [
        PurchaseOut.model_validate(p).model_copy(update={
            "device_brand": brand, "device_model": model,
            "device_imei": imei, "device_category": category,
        })
        for p, brand, model, imei, category in purchase_rows
    ]
    sales = [
        SaleOut.model_validate(s).model_copy(update={
            "device_brand": brand, "device_model": model,
            "device_imei": imei, "device_category": category,
        })
        for s, brand, model, imei, category in sale_rows
    ]
    return CounterpartyDealsOut(
        counterparty=CounterpartyOut.model_validate(counterparty),
        purchases=purchases,
        sales=sales,
    )


@router.patch("/{counterparty_id}", response_model=CounterpartyOut)
async def update_counterparty(
    counterparty_id: int,
    payload: CounterpartyUpdate,
    shop: CurrentShop,
    db: DbSession,
) -> CounterpartyOut:
    try:
        counterparty = await service.get_or_404(
            db, counterparty_id, shop_id=shop.id
        )
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    counterparty = await service.update(
        db, counterparty, **payload.model_dump(exclude_unset=True)
    )
    return CounterpartyOut.model_validate(counterparty)


@router.delete("/{counterparty_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_counterparty(
    counterparty_id: int, shop: CurrentShop, db: DbSession
) -> None:
    """Soft-delete: row is hidden from search but past deals still link to it."""
    try:
        counterparty = await service.get_or_404(
            db, counterparty_id, shop_id=shop.id
        )
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await service.soft_delete(counterparty)
