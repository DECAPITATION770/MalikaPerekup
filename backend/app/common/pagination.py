"""Limit/offset pagination shared by every list endpoint.

Use ``PageParams`` as a FastAPI dependency to parse ``?limit=&offset=`` and
``Page[T]`` as the response model::

    @router.get("/devices", response_model=Page[DeviceOut])
    async def list_devices(params: PageParams = Depends()): ...
"""

from typing import Generic, TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")

DEFAULT_LIMIT = 20
MAX_LIMIT = 100


class PageParams:
    """Query-string params with sane defaults and an upper bound."""

    def __init__(
        self,
        limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
        offset: int = Query(0, ge=0),
    ) -> None:
        self.limit = limit
        self.offset = offset


class Page(BaseModel, Generic[T]):
    """Standard list response envelope."""

    items: list[T]
    total: int
    limit: int
    offset: int

    @classmethod
    def of(cls, items: list[T], total: int, params: PageParams) -> "Page[T]":
        return cls(items=items, total=total, limit=params.limit, offset=params.offset)
