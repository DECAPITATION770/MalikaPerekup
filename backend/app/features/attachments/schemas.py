"""Pydantic schemas — request/response shapes for the attachments API."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# Literal types mirror the SQLAlchemy enums but live here to keep the
# OpenAPI schema strict — FastAPI exposes Pydantic literals as enums in
# the generated client.
OwnerTypeLiteral = Literal[
    "device",
    "purchase",
    "sale",
    "counterparty",
    "installment",
    "catalog_model",
]
KindLiteral = Literal[
    "device_photo",
    "seller_doc",
    "buyer_doc",
    "receipt",
    "warranty",
    "repair",
    "other",
]


class UploadUrlRequest(BaseModel):
    """Body for the presigned-PUT request.

    Mime type + size let the server fail-fast for unsupported / oversize
    uploads before the user spends bandwidth on the PUT; ``kind`` and
    ``note`` are persisted on the attachment row so the timeline carries
    semantic meaning, not just an opaque file.
    """

    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=1, max_length=128)
    size_bytes: int = Field(ge=0, le=50 * 1024 * 1024)  # 50 MB cap per file
    kind: KindLiteral = "other"
    note: str | None = Field(default=None, max_length=500)


class UploadUrlResponse(BaseModel):
    """The presigned PUT URL plus the attachment row id.

    Frontend flow:
    1. POST /attachments/{owner_type}/{owner_id}/upload-url → this response;
    2. PUT bytes directly to ``url`` (Content-Type: payload.mime_type);
    3. (Optional) PATCH the attachment id later to add a caption or reorder.
    """

    url: str
    s3_key: str
    attachment_id: int


class AttachmentOut(BaseModel):
    """Read shape — what the frontend renders in the timeline.

    ``signed_url`` is a fresh presigned GET URL (15 min TTL) refreshed on
    every list call. Older PII attachments expose nothing else by design.
    """

    id: int
    owner_type: OwnerTypeLiteral
    owner_id: int
    kind: KindLiteral
    original_name: str
    mime_type: str
    size_bytes: int
    note: str | None
    sort_order: int
    uploaded_at: datetime
    signed_url: str


class AttachmentPatch(BaseModel):
    """Partial update — caption + sort within a kind group.

    All fields optional so the same endpoint serves «add a note» and
    «move photo to the front of the cover row».
    """

    note: str | None = Field(default=None, max_length=500)
    sort_order: int | None = Field(default=None, ge=0)
