"""create notifications outbox + add users.notification_channels

Revision ID: 0008_create_notifications
Revises: 0007_create_installments
Create Date: 2026-04-26 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008_create_notifications"
down_revision: str | None = "0007_create_installments"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # 1. Add channel preferences to users (defaults to Telegram only).
    op.add_column(
        "users",
        sa.Column(
            "notification_channels",
            sa.JSON,
            nullable=False,
            server_default='["telegram"]',
        ),
    )

    # 2. Outbox table for queued notifications.
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", name="fk_notifications_user_id"),
            nullable=False,
            index=True,
        ),
        sa.Column("channel", sa.String(16), nullable=False),
        sa.Column("kind", sa.String(32), nullable=False),
        sa.Column("payload", sa.JSON, nullable=False, server_default="{}"),
        sa.Column("scheduled_for", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status", sa.String(12), nullable=False, server_default="pending"
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("attempts", sa.Integer, nullable=False, server_default="0"),
        sa.Column("last_error", sa.Text, nullable=True),
        sa.Column("dedup_key", sa.String(120), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_notifications_status_scheduled",
        "notifications",
        ["status", "scheduled_for"],
    )
    op.create_index("ix_notifications_dedup", "notifications", ["dedup_key"])


def downgrade() -> None:
    op.drop_index("ix_notifications_dedup", table_name="notifications")
    op.drop_index(
        "ix_notifications_status_scheduled", table_name="notifications"
    )
    op.drop_table("notifications")
    op.drop_column("users", "notification_channels")
