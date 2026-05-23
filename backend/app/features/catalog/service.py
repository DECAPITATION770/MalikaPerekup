"""Catalog (номенклатура) business logic.

Two write paths:
* manual CRUD from the Номенклатура screen (``get_or_404`` / ``update`` /
  ``delete``);
* ``upsert_for_purchase`` — called inside ``create_purchase`` so a model
  seen on a deal becomes (or refreshes) the shop's reusable template.

The upsert never clobbers data the owner curated by hand: it only fills
spec keys that are still missing and only sets a photo when none exists.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.catalog import repository as repo
from app.features.catalog.models import CatalogModel

# A template keeps at most this many representative photos.
_MAX_PHOTOS = 3


class CatalogError(Exception):
    """Service-level errors mapped to HTTP by the router."""


class CatalogNotFound(CatalogError):
    pass


async def get_or_404(
    db: AsyncSession, catalog_id: int, *, shop_id: int
) -> CatalogModel:
    item = await repo.get_by_id(db, catalog_id, shop_id=shop_id)
    if item is None:
        raise CatalogNotFound("catalog model not found")
    return item


async def update(db: AsyncSession, item: CatalogModel, **patch) -> CatalogModel:
    """Apply a partial update — only fields that are not ``None`` are touched."""
    for field, value in patch.items():
        if value is not None:
            setattr(item, field, value)
    return item


async def delete(db: AsyncSession, item: CatalogModel) -> None:
    await repo.delete(db, item)


async def upsert_for_purchase(
    db: AsyncSession,
    *,
    shop_id: int,
    category: str,
    brand: str,
    model: str,
    specs: dict,
    photos: list[str],
) -> CatalogModel:
    """Create or refresh the template for the model on a purchase.

    On an existing template we only fill spec keys that are still empty and
    only adopt a photo when the template has none — so manual curation wins.
    """
    brand = brand.strip()
    model = model.strip()
    if not brand or not model:
        # Nothing identifiable to template (e.g. accessory with no model).
        return None  # type: ignore[return-value]

    existing = await repo.find_by_model(
        db, shop_id=shop_id, category=category, brand=brand, model=model
    )
    if existing is not None:
        merged = dict(existing.default_specs)
        for key, value in (specs or {}).items():
            if value is not None and merged.get(key) in (None, ""):
                merged[key] = value
        existing.default_specs = merged  # reassign so JSON change is tracked
        if not existing.photos and photos:
            existing.photos = photos[:_MAX_PHOTOS]
        existing.purchase_count += 1
        return existing

    return await repo.create(
        db,
        shop_id=shop_id,
        category=category,
        brand=brand,
        model=model,
        default_specs=dict(specs or {}),
        photos=list(photos or [])[:_MAX_PHOTOS],
        purchase_count=1,
    )
