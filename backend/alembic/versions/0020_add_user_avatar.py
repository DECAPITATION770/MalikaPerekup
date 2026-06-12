"""add users.avatar_key and avatar_fetched_at

Revision ID: 0020_add_user_avatar
Revises: 0019_add_user_is_blocked
Create Date: 2026-06-13 12:00:00

Cached Telegram profile photo (object-storage key) + last fetch timestamp.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0020_add_user_avatar"
down_revision: str | None = "0019_add_user_is_blocked"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("avatar_key", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("avatar_fetched_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "avatar_fetched_at")
    op.drop_column("users", "avatar_key")
