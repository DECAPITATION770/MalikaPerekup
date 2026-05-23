"""add purchase_count to catalog_models

Revision ID: 0014_add_catalog_purchase_count
Revises: 0013_create_catalog_models
Create Date: 2026-05-23 00:00:00

Ranks "Частые" in the purchase wizard by how often a model has been bought
(stable positions for muscle memory) instead of recency. Hand-written —
autogenerate can't diff the existing ``json`` columns (see
0013_create_catalog_models).
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0014_add_catalog_purchase_count"
down_revision: str | None = "0013_create_catalog_models"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "catalog_models",
        sa.Column(
            "purchase_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
    )


def downgrade() -> None:
    op.drop_column("catalog_models", "purchase_count")
