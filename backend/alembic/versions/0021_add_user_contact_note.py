"""add users.admin_contact_note

Revision ID: 0021_add_user_contact_note
Revises: 0020_add_user_avatar
Create Date: 2026-06-13 14:00:00

Free-text admin contact note about a tenant owner (works for non-Telegram users).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0021_add_user_contact_note"
down_revision: str | None = "0020_add_user_avatar"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("admin_contact_note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "admin_contact_note")
