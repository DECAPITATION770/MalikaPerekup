"""HTTP endpoints for polymorphic attachments.

Routes:
* POST   /attachments/{owner_type}/{owner_id}/upload-url — sign + persist row
* GET    /attachments/{owner_type}/{owner_id}            — list (filter ?kind=)
* GET    /attachments/device/{device_id}/timeline        — aggregated story
* PATCH  /attachments/{attachment_id}                    — note / sort_order
* DELETE /attachments/{attachment_id}                    — DB + S3 cleanup

Every route filters by ``current_shop.id`` — multi-tenant invariant from
CLAUDE.md §6. The owner_type Pydantic Literal is the FastAPI-layer gate
against bad input; the service layer re-validates owner existence + shop
ownership so a router-only fix to security is impossible.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, status

from app.core.deps import CurrentShop, CurrentUser, DbSession
from app.features.attachments import service
from app.features.attachments.schemas import (
    AttachmentOut,
    AttachmentPatch,
    KindLiteral,
    OwnerTypeLiteral,
    UploadUrlRequest,
    UploadUrlResponse,
)

router = APIRouter(prefix="/attachments", tags=["attachments"])


def _to_out(att, signed_url: str) -> AttachmentOut:
    """Pack an Attachment ORM row + presigned GET URL into the response shape."""
    return AttachmentOut(
        id=att.id,
        owner_type=att.owner_type,
        owner_id=att.owner_id,
        kind=att.kind,
        original_name=att.original_name,
        mime_type=att.mime_type,
        size_bytes=att.size_bytes,
        note=att.note,
        sort_order=att.sort_order,
        uploaded_at=att.uploaded_at,
        signed_url=signed_url,
    )


@router.post(
    "/{owner_type}/{owner_id}/upload-url",
    response_model=UploadUrlResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_upload_url(
    payload: UploadUrlRequest,
    shop: CurrentShop,
    user: CurrentUser,
    db: DbSession,
    owner_type: Annotated[OwnerTypeLiteral, Path()],
    owner_id: Annotated[int, Path(ge=1)],
) -> UploadUrlResponse:
    """Sign a short-lived PUT URL and persist the attachment row.

    The DB row is created *before* the client PUTs the bytes — see
    service.issue_upload docstring for the trade-off. The transaction is
    auto-committed by the DbSession dependency on successful return.
    """
    url, row = await service.issue_upload(
        db,
        shop_id=shop.id,
        user_id=user.id,
        owner_type=owner_type,
        owner_id=owner_id,
        filename=payload.filename,
        mime_type=payload.mime_type,
        size_bytes=payload.size_bytes,
        kind=payload.kind,
        note=payload.note,
    )
    return UploadUrlResponse(url=url, s3_key=row.s3_key, attachment_id=row.id)


@router.get(
    "/{owner_type}/{owner_id}",
    response_model=list[AttachmentOut],
)
async def list_for_owner(
    shop: CurrentShop,
    db: DbSession,
    owner_type: Annotated[OwnerTypeLiteral, Path()],
    owner_id: Annotated[int, Path(ge=1)],
    kind: Annotated[KindLiteral | None, Query()] = None,
) -> list[AttachmentOut]:
    """List one owner's attachments; optional ?kind= filters semantic group."""
    rows = await service.list_for_owner(
        db,
        shop_id=shop.id,
        owner_type=owner_type,
        owner_id=owner_id,
        kind=kind,
    )
    urls = service.sign_urls(rows)
    return [_to_out(r, urls[r.id]) for r in rows]


@router.get(
    "/device/{device_id}/timeline",
    response_model=list[AttachmentOut],
)
async def device_timeline(
    shop: CurrentShop,
    db: DbSession,
    device_id: Annotated[int, Path(ge=1)],
) -> list[AttachmentOut]:
    """Aggregate the full device story across its purchase + sales.

    Resolves the device's purchase_id and sale_ids on the server, then
    streams attachments from all three owner types in chronological order.
    Powers the StockDetail timeline — the user shouldn't need to navigate
    between Stock / Sales / Counterparty pages to see every file linked
    to one physical unit.
    """
    rows = await service.list_for_device(
        db, shop_id=shop.id, device_id=device_id
    )
    urls = service.sign_urls(rows)
    return [_to_out(r, urls[r.id]) for r in rows]


@router.patch(
    "/{attachment_id}",
    response_model=AttachmentOut,
)
async def patch_attachment(
    payload: AttachmentPatch,
    shop: CurrentShop,
    db: DbSession,
    attachment_id: Annotated[int, Path(ge=1)],
) -> AttachmentOut:
    """Update note or sort_order. Owner_type/owner_id are immutable on purpose —
    moving an attachment between entities would obscure history."""
    row = await service.patch(
        db,
        shop_id=shop.id,
        attachment_id=attachment_id,
        note=payload.note,
        sort_order=payload.sort_order,
    )
    urls = service.sign_urls([row])
    return _to_out(row, urls[row.id])


@router.delete(
    "/{attachment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_attachment(
    shop: CurrentShop,
    db: DbSession,
    attachment_id: Annotated[int, Path(ge=1)],
) -> None:
    """Remove the row and best-effort delete the S3 object. 204 even if the
    S3 delete fails — orphan-key cleanup is a separate (out-of-scope) job."""
    await service.remove(db, shop_id=shop.id, attachment_id=attachment_id)
