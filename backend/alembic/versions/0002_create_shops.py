"""create shops table and link users.shop_id

Revision ID: 0002_create_shops
Revises: 0001_create_users
Create Date: 2026-04-26 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_create_shops"
down_revision: str | None = "0001_create_users"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "shops",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column(
            "owner_id",
            sa.Integer,
            sa.ForeignKey("users.id", name="fk_shops_owner_id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "language_default",
            sa.String(2),
            nullable=False,
            server_default="ru",
        ),
        sa.Column("plan", sa.String(16), nullable=False, server_default="trial"),
        sa.Column("plan_until", sa.Date, nullable=True),
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

    # Link users to their shop. Nullable because users.id is created first
    # (during Telegram auth) and shop_id is set after onboarding.
    op.add_column("users", sa.Column("shop_id", sa.Integer, nullable=True))
    op.create_foreign_key(
        "fk_users_shop_id", "users", "shops", ["shop_id"], ["id"]
    )
    op.create_index("ix_users_shop_id", "users", ["shop_id"])


def downgrade() -> None:
    op.drop_index("ix_users_shop_id", table_name="users")
    op.drop_constraint("fk_users_shop_id", "users", type_="foreignkey")
    op.drop_column("users", "shop_id")
    op.drop_table("shops")
