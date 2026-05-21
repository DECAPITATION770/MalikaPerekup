"""create users table

Revision ID: 0001_create_users
Revises:
Create Date: 2026-04-26 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001_create_users"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("tg_id", sa.BigInteger, nullable=True),
        sa.Column("tg_username", sa.String(64), nullable=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column(
            "language", sa.String(2), nullable=False, server_default="ru"
        ),
        sa.Column("phone", sa.String(32), nullable=True),
        sa.Column("login", sa.String(64), nullable=True),
        sa.Column("password_hash", sa.String(120), nullable=True),
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
    op.create_unique_constraint("uq_users_tg_id", "users", ["tg_id"])
    op.create_unique_constraint("uq_users_login", "users", ["login"])


def downgrade() -> None:
    op.drop_constraint("uq_users_login", "users", type_="unique")
    op.drop_constraint("uq_users_tg_id", "users", type_="unique")
    op.drop_table("users")
