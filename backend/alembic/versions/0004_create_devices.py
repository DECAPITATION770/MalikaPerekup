"""create devices table

Revision ID: 0004_create_devices
Revises: 0003_create_counterparties
Create Date: 2026-04-26 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_create_devices"
down_revision: str | None = "0003_create_counterparties"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "devices",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer,
            sa.ForeignKey("shops.id", name="fk_devices_shop_id"),
            nullable=False,
            index=True,
        ),
        sa.Column("category", sa.String(16), nullable=False),
        sa.Column("brand", sa.String(64), nullable=False),
        sa.Column("model", sa.String(120), nullable=False),
        sa.Column("imei", sa.String(32), nullable=True),
        sa.Column("serial", sa.String(64), nullable=True),
        sa.Column(
            "condition", sa.String(16), nullable=False, server_default="good"
        ),
        sa.Column("specs", sa.JSON, nullable=False, server_default="{}"),
        sa.Column("photos", sa.JSON, nullable=False, server_default="[]"),
        sa.Column(
            "status", sa.String(16), nullable=False, server_default="in_stock"
        ),
        sa.Column("qr_token", sa.String(32), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_by",
            sa.Integer,
            sa.ForeignKey("users.id", name="fk_devices_created_by"),
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
        "uq_devices_qr_token", "devices", ["qr_token"]
    )
    op.create_index("ix_devices_qr_token", "devices", ["qr_token"])
    op.create_unique_constraint(
        "uq_devices_shop_imei", "devices", ["shop_id", "imei"]
    )
    op.create_index(
        "ix_devices_shop_status", "devices", ["shop_id", "status"]
    )


def downgrade() -> None:
    op.drop_index("ix_devices_shop_status", table_name="devices")
    op.drop_constraint("uq_devices_shop_imei", "devices", type_="unique")
    op.drop_index("ix_devices_qr_token", table_name="devices")
    op.drop_constraint("uq_devices_qr_token", "devices", type_="unique")
    op.drop_table("devices")
