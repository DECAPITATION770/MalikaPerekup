"""add users.is_blocked and blocked_at

Revision ID: 0019_add_user_is_blocked
Revises: 0018_create_backup_tables
Create Date: 2026-06-13 10:00:00

Soft block of a user's Telegram/initData access (login/password unaffected).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0019_add_user_is_blocked"
down_revision: str | None = "0018_create_backup_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_blocked", sa.Boolean(), server_default="false", nullable=False
        ),
    )
    op.add_column(
        "users",
        sa.Column("blocked_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "blocked_at")
    op.drop_column("users", "is_blocked")
