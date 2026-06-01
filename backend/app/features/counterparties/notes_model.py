"""CounterpartyNote ORM — chronological interaction log.

A note is a freeform record of «what happened» with a counterparty:
a phone call, an in-person meeting, an SMS reminder, a payment-overdue
warning. The shop owner reads the timeline to remember what to follow
up on; recovery flows (rep handover, audit) lean on it as ground truth.

Kept in a separate file (not :mod:`models`) so the Counterparty model
keeps its tight focus on directory-row fields.
"""

from datetime import datetime
from enum import StrEnum

from sqlalchemy import (
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


class CounterpartyNoteKind(StrEnum):
    """Semantic role — drives icon + colour in the timeline UI.

    ``system`` is reserved for backend-generated notes (e.g. «Купил iPhone 14 Pro»);
    user-typed notes pick one of the other four. Adding a new kind is one
    line — frontend ``KIND_META`` falls back to ``other`` for unknown values.
    """

    CALL = "call"
    MEETING = "meeting"
    MESSAGE = "message"
    PAYMENT = "payment"
    SYSTEM = "system"
    OTHER = "other"


class CounterpartyNote(Base):
    __tablename__ = "counterparty_notes"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Multi-tenant filter — every list / get / mutation MUST include this
    # in WHERE. CLAUDE.md §6 invariant.
    shop_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shops.id"), nullable=False, index=True
    )

    # CASCADE deletion: when a counterparty is hard-deleted (rare; soft
    # delete is the norm), their notes go with them. Soft-deleted parents
    # keep their notes accessible via the dormant directory entry.
    counterparty_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("counterparties.id", ondelete="CASCADE"),
        nullable=False,
    )

    kind: Mapped[str] = mapped_column(
        String(16), nullable=False, server_default=CounterpartyNoteKind.OTHER.value
    )

    body: Mapped[str] = mapped_column(Text, nullable=False)

    created_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )

    __table_args__ = (
        # Covers the only hot query: «give me this counterparty's notes
        # ordered by time». ``shop_id`` is the leading column for the
        # multi-tenant guard; ``counterparty_id`` narrows; ``created_at``
        # supports the ORDER BY without a separate index.
        Index(
            "ix_counterparty_notes_owner_time",
            "shop_id",
            "counterparty_id",
            "created_at",
        ),
    )
