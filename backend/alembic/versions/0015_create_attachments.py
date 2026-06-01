"""create attachments table + backfill from legacy photo arrays

Revision ID: 0015_create_attachments
Revises: 0014_add_catalog_purchase_count
Create Date: 2026-05-30 18:30:00

The five JSON arrays scattered across feature tables (``devices.photos``,
``purchases.seller_photos``, ``counterparties.doc_photos``,
``sales.buyer_photos``, ``catalog_items.photos``) collapse into one
``attachments`` row-per-file table. Old columns stay populated for
backward compatibility; the next-but-one migration drops them once the
frontend fully migrates.

Backfill rules:
* original_name = filename segment of the S3 key (best we can recover
  retroactively — `shops/3/devices/uuid-passport.jpg` → `passport.jpg`).
* mime_type guessed from the extension, defaulting to image/jpeg for the
  common case (these arrays were "photos" by convention).
* uploaded_at = parent row's created_at (or updated_at if absent) — a
  proxy timestamp so the timeline ordering still makes sense.
* uploaded_by = parent row's created_by where the parent has one, else
  the shop's owner. Service-layer queries never use this for security
  (only display) so the fallback is safe.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0015_create_attachments"
down_revision: str | None = "0014_add_catalog_purchase_count"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ── 1) Create the table ────────────────────────────────────────────
    op.create_table(
        "attachments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "shop_id",
            sa.Integer(),
            sa.ForeignKey("shops.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("owner_type", sa.String(length=24), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column(
            "kind",
            sa.String(length=24),
            nullable=False,
            server_default="other",
        ),
        sa.Column(
            "s3_key", sa.String(length=512), nullable=False, unique=True
        ),
        sa.Column(
            "original_name", sa.String(length=255), nullable=False
        ),
        sa.Column("mime_type", sa.String(length=128), nullable=False),
        sa.Column(
            "size_bytes",
            sa.BigInteger(),
            nullable=False,
            server_default="0",
        ),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column(
            "sort_order",
            sa.Integer(),
            nullable=False,
            server_default="0",
        ),
        sa.Column(
            "uploaded_by",
            sa.Integer(),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("CURRENT_TIMESTAMP"),
        ),
    )
    op.create_index(
        "ix_attachments_owner",
        "attachments",
        ["shop_id", "owner_type", "owner_id"],
    )
    op.create_index(
        "ix_attachments_kind",
        "attachments",
        ["shop_id", "kind"],
    )

    # ── 2) Backfill legacy JSON arrays ─────────────────────────────────
    # Postgres can iterate JSON arrays with `jsonb_array_elements_text`;
    # using a single INSERT...SELECT per source table keeps the migration
    # to ~5 statements instead of an N-row Python loop. The shared CTE
    # extracts (idx, key) so we can preserve in-array order via
    # sort_order = ordinality - 1 (matches DocumentUploader semantics).

    # 2a) devices.photos → owner_type=device, kind=device_photo
    op.execute(
        """
        INSERT INTO attachments
            (shop_id, owner_type, owner_id, kind, s3_key, original_name,
             mime_type, size_bytes, sort_order, uploaded_by, uploaded_at)
        SELECT
            d.shop_id,
            'device',
            d.id,
            'device_photo',
            elem.key,
            COALESCE(NULLIF(regexp_replace(elem.key, '^.*/[a-f0-9]{32}-', ''), ''), elem.key),
            CASE
                WHEN elem.key ILIKE '%.png'  THEN 'image/png'
                WHEN elem.key ILIKE '%.heic' THEN 'image/heic'
                WHEN elem.key ILIKE '%.webp' THEN 'image/webp'
                WHEN elem.key ILIKE '%.pdf'  THEN 'application/pdf'
                ELSE 'image/jpeg'
            END,
            0,
            (elem.ordinality - 1)::int,
            d.created_by,
            d.created_at
        FROM devices d
        CROSS JOIN LATERAL jsonb_array_elements_text(d.photos::jsonb) WITH ORDINALITY AS elem(key, ordinality)
        WHERE jsonb_typeof(d.photos::jsonb) = 'array'
          AND jsonb_array_length(d.photos::jsonb) > 0
        ON CONFLICT (s3_key) DO NOTHING;
        """  # noqa: E501
    )

    # 2b) purchases.seller_photos → owner_type=purchase, kind=seller_doc
    op.execute(
        """
        INSERT INTO attachments
            (shop_id, owner_type, owner_id, kind, s3_key, original_name,
             mime_type, size_bytes, sort_order, uploaded_by, uploaded_at)
        SELECT
            p.shop_id,
            'purchase',
            p.id,
            'seller_doc',
            elem.key,
            COALESCE(NULLIF(regexp_replace(elem.key, '^.*/[a-f0-9]{32}-', ''), ''), elem.key),
            CASE
                WHEN elem.key ILIKE '%.pdf'  THEN 'application/pdf'
                WHEN elem.key ILIKE '%.png'  THEN 'image/png'
                WHEN elem.key ILIKE '%.heic' THEN 'image/heic'
                ELSE 'image/jpeg'
            END,
            0,
            (elem.ordinality - 1)::int,
            p.created_by,
            p.created_at
        FROM purchases p
        CROSS JOIN LATERAL jsonb_array_elements_text(p.seller_photos::jsonb) WITH ORDINALITY AS elem(key, ordinality)
        WHERE jsonb_typeof(p.seller_photos::jsonb) = 'array'
          AND jsonb_array_length(p.seller_photos::jsonb) > 0
        ON CONFLICT (s3_key) DO NOTHING;
        """  # noqa: E501
    )

    # 2c) sales.buyer_photos → owner_type=sale, kind=buyer_doc
    op.execute(
        """
        INSERT INTO attachments
            (shop_id, owner_type, owner_id, kind, s3_key, original_name,
             mime_type, size_bytes, sort_order, uploaded_by, uploaded_at)
        SELECT
            s.shop_id,
            'sale',
            s.id,
            'buyer_doc',
            elem.key,
            COALESCE(NULLIF(regexp_replace(elem.key, '^.*/[a-f0-9]{32}-', ''), ''), elem.key),
            CASE
                WHEN elem.key ILIKE '%.pdf'  THEN 'application/pdf'
                WHEN elem.key ILIKE '%.png'  THEN 'image/png'
                WHEN elem.key ILIKE '%.heic' THEN 'image/heic'
                ELSE 'image/jpeg'
            END,
            0,
            (elem.ordinality - 1)::int,
            s.created_by,
            s.created_at
        FROM sales s
        CROSS JOIN LATERAL jsonb_array_elements_text(s.buyer_photos::jsonb) WITH ORDINALITY AS elem(key, ordinality)
        WHERE jsonb_typeof(s.buyer_photos::jsonb) = 'array'
          AND jsonb_array_length(s.buyer_photos::jsonb) > 0
        ON CONFLICT (s3_key) DO NOTHING;
        """  # noqa: E501
    )

    # 2d) counterparties.doc_photos → owner_type=counterparty, kind=seller_doc
    # (kind=seller_doc because the directory mostly stores seller passports;
    # buyer-side counterparties exist too but UI doesn't currently distinguish,
    # so a single neutral kind keeps backfill simple)
    op.execute(
        """
        INSERT INTO attachments
            (shop_id, owner_type, owner_id, kind, s3_key, original_name,
             mime_type, size_bytes, sort_order, uploaded_by, uploaded_at)
        SELECT
            c.shop_id,
            'counterparty',
            c.id,
            'seller_doc',
            elem.key,
            COALESCE(NULLIF(regexp_replace(elem.key, '^.*/[a-f0-9]{32}-', ''), ''), elem.key),
            CASE
                WHEN elem.key ILIKE '%.pdf' THEN 'application/pdf'
                WHEN elem.key ILIKE '%.png' THEN 'image/png'
                ELSE 'image/jpeg'
            END,
            0,
            (elem.ordinality - 1)::int,
            (SELECT u.id FROM users u WHERE u.shop_id = c.shop_id ORDER BY u.id LIMIT 1),
            c.created_at
        FROM counterparties c
        CROSS JOIN LATERAL jsonb_array_elements_text(c.doc_photos::jsonb) WITH ORDINALITY AS elem(key, ordinality)
        WHERE jsonb_typeof(c.doc_photos::jsonb) = 'array'
          AND jsonb_array_length(c.doc_photos::jsonb) > 0
          AND COALESCE(c.files_cleaned, FALSE) = FALSE
        ON CONFLICT (s3_key) DO NOTHING;
        """  # noqa: E501
    )

    # 2e) catalog_models.photos → owner_type=catalog_model, kind=device_photo
    op.execute(
        """
        INSERT INTO attachments
            (shop_id, owner_type, owner_id, kind, s3_key, original_name,
             mime_type, size_bytes, sort_order, uploaded_by, uploaded_at)
        SELECT
            cm.shop_id,
            'catalog_model',
            cm.id,
            'device_photo',
            elem.key,
            COALESCE(NULLIF(regexp_replace(elem.key, '^.*/[a-f0-9]{32}-', ''), ''), elem.key),
            CASE
                WHEN elem.key ILIKE '%.png'  THEN 'image/png'
                WHEN elem.key ILIKE '%.webp' THEN 'image/webp'
                ELSE 'image/jpeg'
            END,
            0,
            (elem.ordinality - 1)::int,
            (SELECT u.id FROM users u WHERE u.shop_id = cm.shop_id ORDER BY u.id LIMIT 1),
            cm.created_at
        FROM catalog_models cm
        CROSS JOIN LATERAL jsonb_array_elements_text(cm.photos::jsonb) WITH ORDINALITY AS elem(key, ordinality)
        WHERE jsonb_typeof(cm.photos::jsonb) = 'array'
          AND jsonb_array_length(cm.photos::jsonb) > 0
        ON CONFLICT (s3_key) DO NOTHING;
        """  # noqa: E501
    )


def downgrade() -> None:
    op.drop_index("ix_attachments_kind", table_name="attachments")
    op.drop_index("ix_attachments_owner", table_name="attachments")
    op.drop_table("attachments")
