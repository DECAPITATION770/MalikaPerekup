"""create installment plans and payments

Revision ID: 0007_create_installments
Revises: 0006_create_sales
Create Date: 2026-04-26 00:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007_create_installments"
down_revision: str | None = "0006_create_sales"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "installment_plans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer,
            sa.ForeignKey("shops.id", name="fk_plans_shop_id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "sale_id",
            sa.Integer,
            sa.ForeignKey(
                "sales.id", name="fk_plans_sale_id", ondelete="CASCADE"
            ),
            nullable=False,
        ),
        sa.Column("total_amount", sa.Numeric(18, 2), nullable=False),
        sa.Column(
            "down_payment", sa.Numeric(18, 2), nullable=False, server_default="0"
        ),
        sa.Column("period_type", sa.String(8), nullable=False),
        sa.Column("period_count", sa.Integer, nullable=False),
        sa.Column("start_date", sa.Date, nullable=False),
        sa.Column(
            "status", sa.String(12), nullable=False, server_default="active"
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cancel_reason", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_unique_constraint(
        "uq_installment_plans_sale_id", "installment_plans", ["sale_id"]
    )
    op.create_index(
        "ix_installment_plans_shop_status",
        "installment_plans",
        ["shop_id", "status"],
    )

    op.create_table(
        "installment_payments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "plan_id",
            sa.Integer,
            sa.ForeignKey(
                "installment_plans.id",
                name="fk_payments_plan_id",
                ondelete="CASCADE",
            ),
            nullable=False,
            index=True,
        ),
        sa.Column("sequence", sa.Integer, nullable=False),
        sa.Column("due_date", sa.Date, nullable=False),
        sa.Column("amount_due", sa.Numeric(18, 2), nullable=False),
        sa.Column(
            "amount_paid", sa.Numeric(18, 2), nullable=False, server_default="0"
        ),
        sa.Column(
            "status", sa.String(16), nullable=False, server_default="pending"
        ),
        sa.Column(
            "kind", sa.String(16), nullable=False, server_default="regular"
        ),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_installment_payments_due",
        "installment_payments",
        ["due_date", "status"],
    )


def downgrade() -> None:
    op.drop_index("ix_installment_payments_due", table_name="installment_payments")
    op.drop_table("installment_payments")
    op.drop_index(
        "ix_installment_plans_shop_status", table_name="installment_plans"
    )
    op.drop_constraint(
        "uq_installment_plans_sale_id", "installment_plans", type_="unique"
    )
    op.drop_table("installment_plans")
