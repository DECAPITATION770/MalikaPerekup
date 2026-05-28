from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.features.auth.models import ROLE_OWNER, User
from app.features.tenants.models import Tenant


class TenantConflict(ValueError):
    """Raised when provisioning would create a duplicate (e.g. tg_id already taken)."""


async def create_with_owner(
    session: AsyncSession,
    *,
    name: str,
    owner_tg_id: int | None,
    owner_tg_username: str | None,
) -> tuple[Tenant, User]:
    """Atomically create a Tenant and its owner User. Raises TenantConflict on duplicates."""
    if owner_tg_id is not None:
        existing = await session.execute(select(User).where(User.tg_id == owner_tg_id))
        if existing.scalar_one_or_none() is not None:
            raise TenantConflict(f"tg_id={owner_tg_id} already belongs to another user")
    elif owner_tg_username is not None:
        existing = await session.execute(
            select(User).where(func.lower(User.tg_username) == owner_tg_username.lower())
        )
        if existing.scalar_one_or_none() is not None:
            raise TenantConflict(f"username @{owner_tg_username} already invited or registered")

    tenant = Tenant(name=name)
    session.add(tenant)
    await session.flush()

    owner = User(
        tenant_id=tenant.id,
        role=ROLE_OWNER,
        tg_id=owner_tg_id,
        tg_username=owner_tg_username,
    )
    session.add(owner)
    await session.flush()
    return tenant, owner


async def list_with_owners(session: AsyncSession) -> list[tuple[Tenant, User | None]]:
    """Return (tenant, owner_user_or_none) tuples ordered by id."""
    result = await session.execute(select(Tenant).order_by(Tenant.id))
    tenants = list(result.scalars())
    if not tenants:
        return []
    owners_q = await session.execute(
        select(User).where(
            User.role == ROLE_OWNER,
            User.tenant_id.in_(t.id for t in tenants),
        )
    )
    owners_by_tenant = {u.tenant_id: u for u in owners_q.scalars()}
    return [(t, owners_by_tenant.get(t.id)) for t in tenants]
