"""create sales table

Revision ID: 0006_create_sales
Revises: 0005_create_purchases
Create Date: 2026-04-26 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0006_create_sales"
down_revision: str | None = "0005_create_purchases"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sales",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer,
            sa.ForeignKey("shops.id", name="fk_sales_shop_id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "device_id",
            sa.Integer,
            sa.ForeignKey(
                "devices.id",
                name="fk_sales_device_id",
                ondelete="CASCADE",
            ),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "counterparty_id",
            sa.Integer,
            sa.ForeignKey(
                "counterparties.id",
                name="fk_sales_counterparty_id",
                ondelete="SET NULL",
            ),
            nullable=True,
            index=True,
        ),

        # Buyer snapshot
        sa.Column("buyer_name", sa.String(120), nullable=False),
        sa.Column("buyer_phone", sa.String(32), nullable=True),
        sa.Column("buyer_doc_type", sa.String(32), nullable=True),
        sa.Column("buyer_doc_number", sa.String(64), nullable=True),
        sa.Column(
            "buyer_photos", sa.JSON, nullable=False, server_default="[]"
        ),

        # Money + profit pin
        sa.Column(
            "sale_type", sa.String(8), nullable=False, server_default="cash"
        ),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("sale_price_uzs", sa.Numeric(18, 2), nullable=False),
        sa.Column("sale_price_usd", sa.Numeric(14, 2), nullable=True),
        sa.Column("exchange_rate", sa.Numeric(18, 4), nullable=True),
        sa.Column("profit_uzs", sa.Numeric(18, 2), nullable=False),
        sa.Column(
            "purchase_price_uzs_snapshot", sa.Numeric(18, 2), nullable=False
        ),

        sa.Column("sale_date", sa.Date, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),

        sa.Column(
            "status", sa.String(12), nullable=False, server_default="active"
        ),
        sa.Column("return_reason", sa.Text, nullable=True),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),

        sa.Column(
            "created_by",
            sa.Integer,
            sa.ForeignKey("users.id", name="fk_sales_created_by"),
            nullable=False,
        ),
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
    op.create_index("ix_sales_shop_date", "sales", ["shop_id", "sale_date"])
    op.create_index("ix_sales_shop_status", "sales", ["shop_id", "status"])


def downgrade() -> None:
    op.drop_index("ix_sales_shop_status", table_name="sales")
    op.drop_index("ix_sales_shop_date", table_name="sales")
    op.drop_table("sales")
