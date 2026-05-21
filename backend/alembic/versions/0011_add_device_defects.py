"""add defects column to devices

Revision ID: 0011_add_device_defects
Revises: 0010_create_cbu_rate_cache
Create Date: 2026-05-20 00:00:00

Per docs/purchase-wizard-plan.md (Wave 0): the wizard's "Defect checklist"
step (UI step 2) needs a place to store the raw list of toggled flags.
Examples: ``["screen_replaced", "battery_replaced", "scratches"]``.

The pre-existing ``condition`` enum (new/good/normal/broken) is kept and
computed on the frontend from this list — that preserves the Stock filter.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0011_add_device_defects"
down_revision: str | None = "0010_create_cbu_rate_cache"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "devices",
        sa.Column(
            "defects",
            sa.JSON,
            nullable=False,
            server_default="[]",
        ),
    )


def downgrade() -> None:
    op.drop_column("devices", "defects")
