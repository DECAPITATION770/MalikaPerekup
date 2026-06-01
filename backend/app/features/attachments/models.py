"""Attachment ORM — polymorphic file row.

``owner_type`` + ``owner_id`` together address the parent entity. No DB-level
FK constraint here because the target table varies per row; the service
layer validates existence + ``shop_id`` ownership on every write, which
both keeps multi-tenancy strict and survives soft-deletes on parents
(a deleted device still has files that need cleanup).
"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.common.dates import now_utc
from app.core.database import Base


class AttachmentOwnerType(StrEnum):
    """All entities that can carry attachments."""

    DEVICE = "device"
    PURCHASE = "purchase"
    SALE = "sale"
    COUNTERPARTY = "counterparty"
    INSTALLMENT = "installment"
    CATALOG_MODEL = "catalog_model"


class AttachmentKind(StrEnum):
    """Semantic role of the file — drives icon + grouping in the timeline UI.

    Kept short and stable; new kinds must extend the enum so the frontend
    can match on a known set instead of free-form strings.
    """

    DEVICE_PHOTO = "device_photo"  # front/back/defects of the device
    SELLER_DOC = "seller_doc"  # seller's passport, signed contract
    BUYER_DOC = "buyer_doc"  # buyer's passport, contract
    RECEIPT = "receipt"  # paper receipt / sales contract
    WARRANTY = "warranty"  # warranty card
    REPAIR = "repair"  # repair invoice / shop ticket
    OTHER = "other"


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Multi-tenant filter — every list / get query MUST include this in WHERE.
    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=False, index=True
    )

    # Polymorphic FK: owner_type ∈ AttachmentOwnerType, owner_id is the
    # target table's primary key. Combined with shop_id this is the only
    # index used by the list query, so it covers the hot path.
    owner_type: Mapped[str] = mapped_column(String(24), nullable=False)
    owner_id: Mapped[int] = mapped_column(Integer, nullable=False)

    # Semantic role. Defaults to ``other`` so legacy uploads coming through
    # the generic uploader without a hint don't get blocked by validation.
    kind: Mapped[str] = mapped_column(
        String(24), nullable=False, server_default=AttachmentKind.OTHER.value
    )

    # S3 key (MinIO local, R2 prod). Unique because the same key cannot
    # logically belong to two attachments — uploads always mint a fresh
    # uuid4 segment in :func:`app.common.storage.build_upload_key`.
    s3_key: Mapped[str] = mapped_column(String(512), nullable=False, unique=True)

    # Original filename + MIME let the UI render «passport.pdf · 1.2 MB»
    # instead of an opaque S3 path. size_bytes is BigInteger because PDFs
    # of scanned passports routinely cross 2 GB on cheap Android cameras.
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(128), nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)

    # Free-form caption so the timeline reads as a story («Скриншот переписки»,
    # «Чек о ремонте 12.05»), not just a chronological file list.
    note: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Within an (owner_type, owner_id, kind) group lets the user reorder
    # photos — first one becomes the cover image on Stock/StockDetail.
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    uploaded_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    __table_args__ = (
        # Covers the only hot-path query: «give me everything attached
        # to this entity in this shop, ordered by sort then upload time».
        Index("ix_attachments_owner", "shop_id", "owner_type", "owner_id"),
        # Powers `?kind=` filters on the list endpoint (e.g. only device_photo).
        Index("ix_attachments_kind", "shop_id", "kind"),
    )
