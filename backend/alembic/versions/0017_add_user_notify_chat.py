"""add users.notify_tg_chat_id

Revision ID: 0017_add_user_notify_chat
Revises: 0016_counterparty_pin_and_notes
Create Date: 2026-06-11 11:00:00

Optional override chat for Telegram reminders. NULL (the default) keeps the
existing behaviour — send to the user's own ``tg_id``. A non-null value lets
the owner route reminders to a separate chat (shared shop group / second
account) from Settings → Уведомления.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0017_add_user_notify_chat"
down_revision: str | None = "0016_counterparty_pin_and_notes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("notify_tg_chat_id", sa.BigInteger(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("users", "notify_tg_chat_id")
