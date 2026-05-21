"""create counterparties table

Revision ID: 0003_create_counterparties
Revises: 0002_create_shops
Create Date: 2026-04-26 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_create_counterparties"
down_revision: str | None = "0002_create_shops"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "counterparties",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer,
            sa.ForeignKey("shops.id", name="fk_counterparties_shop_id"),
            nullable=False,
            index=True,
        ),
        sa.Column("type", sa.String(8), nullable=False, server_default="seller"),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column("phone", sa.String(32), nullable=True),
        sa.Column("doc_type", sa.String(32), nullable=True),
        sa.Column("doc_number", sa.String(64), nullable=True),
        sa.Column(
            "doc_photos", sa.JSON, nullable=False, server_default="[]"
        ),
        sa.Column("tg_username", sa.String(64), nullable=True),
        sa.Column("comment", sa.Text, nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_counterparties_shop_phone", "counterparties", ["shop_id", "phone"]
    )
    op.create_index(
        "ix_counterparties_shop_name", "counterparties", ["shop_id", "full_name"]
    )


def downgrade() -> None:
    op.drop_index("ix_counterparties_shop_name", table_name="counterparties")
    op.drop_index("ix_counterparties_shop_phone", table_name="counterparties")
    op.drop_table("counterparties")
