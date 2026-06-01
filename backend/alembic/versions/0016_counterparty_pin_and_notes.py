"""add counterparties.is_pinned + counterparty_notes table

Revision ID: 0016_counterparty_pin_and_notes
Revises: 0015_create_attachments
Create Date: 2026-05-30 20:00:00

Two related CRM features in one revision because both target the
counterparties domain and ship together:

* ``counterparties.is_pinned`` — VIP flag that floats a row to the top of
  the directory regardless of debt / activity recency.
* ``counterparty_notes`` — chronological interaction log (call,
  meeting, message, payment, system, other). Drives the timeline panel
  on CounterpartyDetail.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0016_counterparty_pin_and_notes"
down_revision: str | None = "0015_create_attachments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1) is_pinned flag ──────────────────────────────────────────────
    op.add_column(
        "counterparties",
        sa.Column(
            "is_pinned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # ── 2) counterparty_notes table ────────────────────────────────────
    op.create_table(
        "counterparty_notes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer(),
            sa.ForeignKey("shops.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "counterparty_id",
            sa.Integer(),
            sa.ForeignKey("counterparties.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "kind",
            sa.String(length=16),
            nullable=False,
            server_default="other",
        ),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "created_by",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_counterparty_notes_owner_time",
        "counterparty_notes",
        ["shop_id", "counterparty_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_counterparty_notes_owner_time", table_name="counterparty_notes"
    )
    op.drop_table("counterparty_notes")
    op.drop_column("counterparties", "is_pinned")
