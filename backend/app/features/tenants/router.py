from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.features.auth.dependencies import CurrentUser, require_super_admin
from app.features.auth.models import User
from app.features.tenants import repository
from app.features.tenants.models import Tenant
from app.features.tenants.schemas import (
    OwnerSummary,
    TenantCreate,
    TenantResponse,
)

router = APIRouter(prefix="/api/admin/tenants", tags=["admin"])


def _to_response(tenant: Tenant, owner: User | None) -> TenantResponse:
    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        is_active=tenant.is_active,
        created_at=tenant.created_at,
        suspended_at=tenant.suspended_at,
        owner=(
            OwnerSummary(
                id=owner.id,
                tg_id=owner.tg_id,
                tg_username=owner.tg_username,
                tg_first_name=owner.tg_first_name,
            )
            if owner
            else None
        ),
    )


@router.post("", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    body: TenantCreate,
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[CurrentUser, Depends(require_super_admin)],
) -> TenantResponse:
    try:
        tenant, owner = await repository.create_with_owner(
            session,
            name=body.name,
            owner_tg_id=body.owner_tg_id,
            owner_tg_username=body.owner_tg_username,
        )
    except repository.TenantConflict as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    await session.commit()
    return _to_response(tenant, owner)


@router.get("", response_model=list[TenantResponse])
async def list_tenants(
    session: Annotated[AsyncSession, Depends(get_session)],
    _admin: Annotated[CurrentUser, Depends(require_super_admin)],
) -> list[TenantResponse]:
    pairs = await repository.list_with_owners(session)
    return [_to_response(t, o) for t, o in pairs]
