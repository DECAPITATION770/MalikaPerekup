"""HTTP endpoints for the catalog (номенклатура) directory."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError

from app.common.pagination import Page, PageParams
from app.common.storage import build_upload_key, presigned_put_url, presigned_url
from app.core.deps import CurrentShop, DbSession
from app.features.catalog import repository as repo
from app.features.catalog import service
from app.features.catalog.models import CatalogModel
from app.features.catalog.schemas import (
    CatalogModelCreate,
    CatalogModelOut,
    CatalogModelUpdate,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.features.devices.schemas import DeviceCategoryLiteral
from app.features.devices.specs import SpecsValidationError, validate_specs

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _to_out(item: CatalogModel) -> CatalogModelOut:
    """Serialise a template with short-lived signed URLs for its photos."""
    out = CatalogModelOut.model_validate(item)
    out.photo_urls = [presigned_url(key) for key in item.photos]
    return out


def _validate_specs(category: str, specs: dict) -> dict:
    try:
        return validate_specs(category, specs)
    except SpecsValidationError as exc:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"invalid specs: {exc}"
        ) from exc


@router.get("", response_model=Page[CatalogModelOut])
async def list_catalog(
    shop: CurrentShop,
    db: DbSession,
    params: Annotated[PageParams, Depends()],
    q: Annotated[str | None, Query(description="search by brand or model")] = None,
    category: Annotated[
        DeviceCategoryLiteral | None, Query(description="filter by category")
    ] = None,
) -> Page[CatalogModelOut]:
    """Browse the shop's model templates — also powers the wizard picker."""
    items, total = await repo.search(
        db,
        shop_id=shop.id,
        query=q,
        category=category,
        limit=params.limit,
        offset=params.offset,
    )
    return Page.of(
        items=[_to_out(it) for it in items], total=total, params=params
    )


@router.post("", response_model=CatalogModelOut, status_code=status.HTTP_201_CREATED)
async def create_catalog(
    payload: CatalogModelCreate, shop: CurrentShop, db: DbSession
) -> CatalogModelOut:
    """Add a model template by hand from the Номенклатура screen."""
    clean_specs = _validate_specs(payload.category, payload.default_specs)
    try:
        item = await repo.create(
            db,
            shop_id=shop.id,
            category=payload.category,
            brand=payload.brand.strip(),
            model=payload.model.strip(),
            default_specs=clean_specs,
            photos=payload.photos,
        )
    except IntegrityError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "this model already exists in the catalog"
        ) from exc
    return _to_out(item)


@router.post("/upload-url", response_model=UploadUrlResponse)
async def request_catalog_upload_url(
    payload: UploadUrlRequest, shop: CurrentShop
) -> UploadUrlResponse:
    """Sign a short-lived PUT URL for a catalog photo (scope ``catalog``)."""
    key = build_upload_key(shop.id, "catalog", payload.filename)
    return UploadUrlResponse(url=presigned_put_url(key), key=key)


@router.get("/{catalog_id}", response_model=CatalogModelOut)
async def get_catalog(
    catalog_id: int, shop: CurrentShop, db: DbSession
) -> CatalogModelOut:
    try:
        item = await service.get_or_404(db, catalog_id, shop_id=shop.id)
    except service.CatalogNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    return _to_out(item)


@router.patch("/{catalog_id}", response_model=CatalogModelOut)
async def update_catalog(
    catalog_id: int,
    payload: CatalogModelUpdate,
    shop: CurrentShop,
    db: DbSession,
) -> CatalogModelOut:
    try:
        item = await service.get_or_404(db, catalog_id, shop_id=shop.id)
    except service.CatalogNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc

    patch = payload.model_dump(exclude_unset=True)
    if "default_specs" in patch and patch["default_specs"] is not None:
        category = patch.get("category") or item.category
        patch["default_specs"] = _validate_specs(category, patch["default_specs"])

    try:
        item = await service.update(db, item, **patch)
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "this model already exists in the catalog"
        ) from exc
    return _to_out(item)


@router.delete("/{catalog_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_catalog(
    catalog_id: int, shop: CurrentShop, db: DbSession
) -> None:
    try:
        item = await service.get_or_404(db, catalog_id, shop_id=shop.id)
    except service.CatalogNotFound as exc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(exc)) from exc
    await service.delete(db, item)
