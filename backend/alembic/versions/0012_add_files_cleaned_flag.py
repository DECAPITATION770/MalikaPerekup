"""add files_cleaned flag to counterparties

Revision ID: 0012_add_files_cleaned_flag
Revises: 0011_add_device_defects
Create Date: 2026-05-21 00:00:00

CLAUDE.md §10 — when a counterparty is soft-deleted we owe the user a
deletion of their passport scans from object storage. The
``cleanup_deleted_counterparty_files`` background job (registered in
``bot.scheduler``) flips this flag true once the ``doc_photos`` keys have
been removed from MinIO/R2.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0012_add_files_cleaned_flag"
down_revision: str | None = "0011_add_device_defects"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "counterparties",
        sa.Column(
            "files_cleaned",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    # Pre-existing soft-deletes treated as already cleaned so the worker
    # doesn't try to scrub buckets we never owned.
    op.execute(
        "UPDATE counterparties SET files_cleaned = true WHERE deleted_at IS NOT NULL"
    )


def downgrade() -> None:
    op.drop_column("counterparties", "files_cleaned")
