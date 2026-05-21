"""create platform admins, access attempts, freeze + last-login fields

Revision ID: 0009_create_admin
Revises: 0008_create_notifications
Create Date: 2026-04-27 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0009_create_admin"
down_revision: str | None = "0008_create_notifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. platform_admins
    op.create_table(
        "platform_admins",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("tg_id", sa.BigInteger, nullable=True),
        sa.Column("tg_username", sa.String(64), nullable=True),
        sa.Column("login", sa.String(64), nullable=True),
        sa.Column("password_hash", sa.String(120), nullable=True),
        sa.Column("full_name", sa.String(120), nullable=False),
        sa.Column(
            "is_active", sa.Boolean, nullable=False, server_default="true"
        ),
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
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
        "uq_platform_admins_tg_id", "platform_admins", ["tg_id"]
    )
    op.create_unique_constraint(
        "uq_platform_admins_login", "platform_admins", ["login"]
    )

    # 2. access_attempts (append-only audit log)
    op.create_table(
        "access_attempts",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "attempted_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("identifier", sa.String(120), nullable=False),
        sa.Column("tg_username", sa.String(64), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
        sa.Column("success", sa.Boolean, nullable=False),
        sa.Column("reason", sa.Text, nullable=True),
        sa.Column("user_id", sa.Integer, nullable=True),
    )
    op.create_index(
        "ix_access_attempts_source_time",
        "access_attempts",
        ["source", "attempted_at"],
    )
    op.create_index(
        "ix_access_attempts_identifier", "access_attempts", ["identifier"]
    )
    op.create_index(
        "ix_access_attempts_success_time",
        "access_attempts",
        ["success", "attempted_at"],
    )

    # 3. shops freeze fields
    op.add_column(
        "shops",
        sa.Column(
            "is_frozen",
            sa.Boolean,
            nullable=False,
            server_default="false",
        ),
    )
    op.add_column(
        "shops",
        sa.Column("frozen_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column("shops", sa.Column("frozen_reason", sa.Text, nullable=True))

    # 4. users last-login bookkeeping
    op.add_column(
        "users",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "users", sa.Column("last_login_source", sa.String(16), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("users", "last_login_source")
    op.drop_column("users", "last_login_at")

    op.drop_column("shops", "frozen_reason")
    op.drop_column("shops", "frozen_at")
    op.drop_column("shops", "is_frozen")

    op.drop_index(
        "ix_access_attempts_success_time", table_name="access_attempts"
    )
    op.drop_index(
        "ix_access_attempts_identifier", table_name="access_attempts"
    )
    op.drop_index(
        "ix_access_attempts_source_time", table_name="access_attempts"
    )
    op.drop_table("access_attempts")

    op.drop_constraint(
        "uq_platform_admins_login", "platform_admins", type_="unique"
    )
    op.drop_constraint(
        "uq_platform_admins_tg_id", "platform_admins", type_="unique"
    )
    op.drop_table("platform_admins")
