"""HTTP endpoints for shop profile management.

Closed-platform note: there is **no public** ``POST /shops`` — shops are
created exclusively by the platform admin (``POST /admin/shops``).
"""

from fastapi import APIRouter

from app.core.deps import CurrentShop, DbSession
from app.features.shops import service
from app.features.shops.schemas import ShopOut, ShopUpdate

router = APIRouter(prefix="/shops", tags=["shops"])


@router.get("/me", response_model=ShopOut)
async def get_my_shop(shop: CurrentShop) -> ShopOut:
    """Return the shop the current user belongs to."""
    return ShopOut.model_validate(shop)


@router.patch("/me", response_model=ShopOut)
async def update_my_shop(
    payload: ShopUpdate, shop: CurrentShop, db: DbSession
) -> ShopOut:
    """Update shop name or default language from Settings."""
    shop = await service.update_shop(
        db,
        shop,
        name=payload.name,
        language_default=payload.language_default,
    )
    return ShopOut.model_validate(shop)
