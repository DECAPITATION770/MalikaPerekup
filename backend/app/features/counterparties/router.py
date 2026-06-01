"""HTTP endpoints for the counterparties directory."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.common.pagination import Page, PageParams
from app.common.storage import build_upload_key, presigned_put_url, presigned_url
from app.core.deps import CurrentShop, CurrentUser, DbSession
from app.features.counterparties import notes_service
from app.features.counterparties import repository as repo
from app.features.counterparties import service
from app.features.counterparties.schemas import (
    CounterpartyCreate,
    CounterpartyDealsOut,
    CounterpartyListItem,
    CounterpartyNoteCreate,
    CounterpartyNoteOut,
    CounterpartyOut,
    CounterpartyPin,
    CounterpartyStats,
    CounterpartyType,
    CounterpartyUpdate,
)
from app.features.purchases import repository as purchase_repo
from app.features.purchases.schemas import PurchaseOut
from app.features.sales import repository as sale_repo
from app.features.sales.schemas import SaleOut

router = APIRouter(prefix="/counterparties", tags=["counterparties"])


class _DocUploadUrlRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=120)


class _DocUploadUrlResponse(BaseModel):
    url: str
    key: str


class _DocFile(BaseModel):
    url: str
    name: str


class _DocFilesResponse(BaseModel):
    """Short-lived signed GET URLs for a counterparty's documents."""

    files: list[_DocFile]


def _doc_name(key: str) -> str:
    """Human filename from a storage key ``shops/.../{uuid}-{safe}``."""
    seg = key.rsplit("/", 1)[-1]
    head, _, tail = seg.partition("-")
    return tail if len(head) == 32 and tail else seg


@router.get("", response_model=Page[CounterpartyListItem])
async def list_counterparties(
    shop: CurrentShop,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    q: Annotated[str | None, Query(description="search by name or phone")] = None,
    type_: Annotated[
        CounterpartyType | None,
        Query(alias="type", description="filter by role"),
    ] = None,
) -> Page[CounterpartyListItem]:
    """Search the directory with per-row aggregates (debt + deal count + last
    deal date). Used both by the standalone screen and by the autocomplete in
    purchase/sale forms — the extra fields are cheap to ignore client-side."""
    rows, total = await repo.search_with_aggregates(
        db,
        shop_id=shop.id,
        query=q,
        type_=type_,
        limit=params.limit,
        offset=params.offset,
    )
    items = [
        CounterpartyListItem(
            **CounterpartyOut.model_validate(cp).model_dump(),
            deals_count=deals,
            outstanding_nasiya_uzs=owed,
            last_deal_at=last_at,
        )
        for cp, deals, owed, last_at in rows
    ]
    return Page.of(items=items, total=total, params=params)


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


# Literal path — declared before ``/{counterparty_id}`` so the int converter
# doesn't try to parse "upload-url" as an id.
@router.post("/upload-url", response_model=_DocUploadUrlResponse)
async def request_doc_upload_url(
    payload: _DocUploadUrlRequest, shop: CurrentShop
) -> _DocUploadUrlResponse:
    """Sign a short-lived PUT URL for a counterparty document (any file type:
    passport scan, photo, PDF…). The Mini App uploads straight to MinIO/R2;
    the returned ``key`` is attached via ``PATCH /{id}`` (``doc_photos``)."""
    key = build_upload_key(shop.id, "counterparties", payload.filename)
    return _DocUploadUrlResponse(url=presigned_put_url(key), key=key)


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


@router.patch("/{counterparty_id}/pin", response_model=CounterpartyOut)
async def pin_counterparty(
    counterparty_id: int,
    payload: CounterpartyPin,
    shop: CurrentShop,
    db: DbSession,
) -> CounterpartyOut:
    """Toggle the VIP pin flag — pinned rows always sort first in the
    directory. Idempotent: pinning an already-pinned row returns the
    current state without an error."""
    try:
        await notes_service.pin_counterparty(
            db,
            shop_id=shop.id,
            counterparty_id=counterparty_id,
            pinned=payload.is_pinned,
        )
        counterparty = await service.get_or_404(
            db, counterparty_id, shop_id=shop.id
        )
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return CounterpartyOut.model_validate(counterparty)


@router.get(
    "/{counterparty_id}/notes",
    response_model=list[CounterpartyNoteOut],
)
async def list_counterparty_notes(
    counterparty_id: int, shop: CurrentShop, db: DbSession
) -> list[CounterpartyNoteOut]:
    """Chronological interaction log — what we said to/about this person,
    newest first. Driven by the timeline panel on CounterpartyDetail."""
    try:
        rows = await notes_service.list_notes(
            db, shop_id=shop.id, counterparty_id=counterparty_id
        )
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return [CounterpartyNoteOut.model_validate(r) for r in rows]


@router.post(
    "/{counterparty_id}/notes",
    response_model=CounterpartyNoteOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_counterparty_note(
    counterparty_id: int,
    payload: CounterpartyNoteCreate,
    shop: CurrentShop,
    user: CurrentUser,
    db: DbSession,
) -> CounterpartyNoteOut:
    """Append a new note. Body is required; kind defaults to ``other``
    for the «just a comment» case."""
    try:
        note = await notes_service.create_note(
            db,
            shop_id=shop.id,
            user_id=user.id,
            counterparty_id=counterparty_id,
            body=payload.body,
            kind=payload.kind,
        )
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return CounterpartyNoteOut.model_validate(note)


@router.delete(
    "/{counterparty_id}/notes/{note_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_counterparty_note(
    counterparty_id: int,
    note_id: int,
    shop: CurrentShop,
    db: DbSession,
) -> None:
    """Hard-delete one note. Shop-id check is enforced inside the service —
    a foreign id returns 404, not a hint that it exists in another shop."""
    # `counterparty_id` is currently unused for routing (notes carry their
    # own shop guard), but kept in the path for symmetry and future moves
    # where a note can be reassigned between counterparties.
    del counterparty_id
    await notes_service.delete_note(db, shop_id=shop.id, note_id=note_id)


@router.get("/{counterparty_id}/stats", response_model=CounterpartyStats)
async def get_counterparty_stats(
    counterparty_id: int, shop: CurrentShop, db: DbSession
) -> CounterpartyStats:
    """Lifetime money + count rollups — drives the strip at the top of
    CounterpartyDetail («Принёс 12.5M · Купил 4M · 2 активных Nasiya»).
    Separate from /deals because it touches three tables and the caller
    often wants the headline without the full deal history.
    """
    try:
        await service.get_or_404(db, counterparty_id, shop_id=shop.id)
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    stats = await repo.stats_for_counterparty(
        db, shop_id=shop.id, counterparty_id=counterparty_id
    )
    return CounterpartyStats(**stats)


@router.get("/{counterparty_id}/doc-urls", response_model=_DocFilesResponse)
async def get_counterparty_doc_urls(
    counterparty_id: int, shop: CurrentShop, db: DbSession
) -> _DocFilesResponse:
    """Sign short-lived GET URLs for a counterparty's documents (PII, §10).

    ``doc_photos`` are private S3 keys, so the Mini App calls this for
    TTL-limited URLs. Shop-scoped via ``get_or_404`` — a foreign id 404s,
    never another shop's documents."""
    try:
        counterparty = await service.get_or_404(
            db, counterparty_id, shop_id=shop.id
        )
    except service.CounterpartyNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return _DocFilesResponse(
        files=[
            _DocFile(url=presigned_url(key), name=_doc_name(key))
            for key in counterparty.doc_photos
        ]
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
