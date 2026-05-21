"""Shop business logic — profile updates only.

Shop creation is owned by ``app.features.admin.service.register_shop_with_owner``
which atomically provisions a User + Shop pair. This module no longer
exposes a public onboarding helper.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.features.shops.models import Shop


class ShopError(Exception):
    """Service-level errors mapped to HTTP by the router."""


async def update_shop(
    db: AsyncSession,
    shop: Shop,
    *,
    name: str | None = None,
    language_default: str | None = None,
) -> Shop:
    """Apply non-None patch fields to ``shop``."""
    if name is not None:
        shop.name = name
    if language_default is not None:
        shop.language_default = language_default
    return shop
