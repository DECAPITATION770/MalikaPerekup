from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class OwnerSummary(BaseModel):
    id: int
    tg_id: int | None
    tg_username: str | None
    tg_first_name: str | None


class TenantCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    owner_tg_id: int | None = None
    owner_tg_username: str | None = Field(default=None, max_length=64)

    @model_validator(mode="after")
    def _exactly_one_owner_id(self) -> "TenantCreate":
        if (self.owner_tg_id is None) == (self.owner_tg_username is None):
            raise ValueError("provide exactly one of owner_tg_id or owner_tg_username")
        if self.owner_tg_username:
            # Normalize: strip leading @
            self.owner_tg_username = self.owner_tg_username.lstrip("@").strip()
            if not self.owner_tg_username:
                raise ValueError("owner_tg_username cannot be empty")
        return self


class TenantResponse(BaseModel):
    id: int
    name: str
    is_active: bool
    created_at: datetime
    suspended_at: datetime | None
    owner: OwnerSummary | None
