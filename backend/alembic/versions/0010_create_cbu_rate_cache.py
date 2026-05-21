"""create cbu_rate_cache — daily official USD→UZS mirror

Revision ID: 0010_create_cbu_rate_cache
Revises: 0009_create_admin
Create Date: 2026-05-18 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0010_create_cbu_rate_cache"
down_revision: str | None = "0009_create_admin"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Global reference data — one official rate per calendar date, so the
    # publication date is the primary key (no shop_id by design).
    op.create_table(
        "cbu_rate_cache",
        sa.Column("date", sa.Date, primary_key=True),
        sa.Column("usd_rate", sa.Numeric(14, 4), nullable=False),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_table("cbu_rate_cache")
