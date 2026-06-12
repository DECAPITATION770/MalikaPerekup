"""create backup tables

Revision ID: 0018_create_backup_tables
Revises: 0017_add_user_notify_chat
Create Date: 2026-06-12 11:30:00

Platform-level backup system: ``backup_config`` (singleton, id == 1) holds the
schedule / retention / Telegram-delivery settings; ``backup_runs`` is the
history of backup runs. No ``shop_id`` — backups span the whole instance and
are admin-only. Enum-like fields are stored as strings (project convention),
so the migration is plain columns with no native PG ENUM types.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0018_create_backup_tables"
down_revision: str | None = "0017_add_user_notify_chat"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "backup_config",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "enabled", sa.Boolean(), server_default="false", nullable=False
        ),
        sa.Column(
            "frequency", sa.String(length=16), server_default="off", nullable=False
        ),
        sa.Column("daily_time", sa.Time(), nullable=True),
        sa.Column("interval_hours", sa.Integer(), nullable=True),
        sa.Column(
            "retention_count", sa.Integer(), server_default="7", nullable=False
        ),
        sa.Column("tg_chat_id", sa.BigInteger(), nullable=True),
        sa.Column(
            "tg_auto_send", sa.Boolean(), server_default="false", nullable=False
        ),
        sa.Column(
            "tg_delivery_mode", sa.String(length=16),
            server_default="full_if_fits", nullable=False,
        ),
        sa.Column(
            "tg_part_size_mb", sa.Integer(), server_default="49", nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False
        ),
    )
    op.create_table(
        "backup_runs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("trigger", sa.String(length=16), nullable=False),
        sa.Column("filename", sa.Text(), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=True),
        sa.Column("object_count", sa.Integer(), nullable=True),
        sa.Column("alembic_revision", sa.Text(), nullable=True),
        sa.Column(
            "sent_to_tg", sa.Boolean(), server_default="false", nullable=False
        ),
        sa.Column("error", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("backup_runs")
    op.drop_table("backup_config")
