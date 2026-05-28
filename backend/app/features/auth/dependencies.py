from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status

from app.features.auth import jwt_service
from app.features.auth.models import ROLE_SUPER_ADMIN


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """Auth context for a request. Built from JWT claims only (no DB query per request)."""

    id: int
    tenant_id: int | None
    role: str

    @property
    def is_super_admin(self) -> bool:
        return self.role == ROLE_SUPER_ADMIN


async def current_user(
    authorization: Annotated[str | None, Header()] = None,
) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="missing bearer token"
        )
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt_service.verify(token)
    except jwt_service.InvalidToken as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc
    return CurrentUser(id=payload.user_id, tenant_id=payload.tenant_id, role=payload.role)


async def require_super_admin(
    user: Annotated[CurrentUser, Depends(current_user)],
) -> CurrentUser:
    if not user.is_super_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="super-admin only"
        )
    return user
