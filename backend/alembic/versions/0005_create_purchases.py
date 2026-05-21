"""create purchases table

Revision ID: 0005_create_purchases
Revises: 0004_create_devices
Create Date: 2026-04-26 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_create_purchases"
down_revision: str | None = "0004_create_devices"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "purchases",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer,
            sa.ForeignKey("shops.id", name="fk_purchases_shop_id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "device_id",
            sa.Integer,
            sa.ForeignKey(
                "devices.id",
                name="fk_purchases_device_id",
                ondelete="CASCADE",
            ),
            nullable=False,
        ),
        sa.Column(
            "counterparty_id",
            sa.Integer,
            sa.ForeignKey(
                "counterparties.id",
                name="fk_purchases_counterparty_id",
                ondelete="SET NULL",
            ),
            nullable=True,
            index=True,
        ),

        # Seller snapshot
        sa.Column("seller_name", sa.String(120), nullable=False),
        sa.Column("seller_phone", sa.String(32), nullable=True),
        sa.Column("seller_doc_type", sa.String(32), nullable=True),
        sa.Column("seller_doc_number", sa.String(64), nullable=True),
        sa.Column(
            "seller_photos", sa.JSON, nullable=False, server_default="[]"
        ),

        # Money
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("price_uzs", sa.Numeric(18, 2), nullable=False),
        sa.Column("price_usd", sa.Numeric(14, 2), nullable=True),
        sa.Column("exchange_rate", sa.Numeric(18, 4), nullable=True),

        sa.Column("purchase_date", sa.Date, nullable=False),
        sa.Column("comment", sa.Text, nullable=True),

        sa.Column(
            "created_by",
            sa.Integer,
            sa.ForeignKey("users.id", name="fk_purchases_created_by"),
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
    op.create_unique_constraint(
        "uq_purchases_device_id", "purchases", ["device_id"]
    )
    op.create_index(
        "ix_purchases_shop_date", "purchases", ["shop_id", "purchase_date"]
    )


def downgrade() -> None:
    op.drop_index("ix_purchases_shop_date", table_name="purchases")
    op.drop_constraint("uq_purchases_device_id", "purchases", type_="unique")
    op.drop_table("purchases")
