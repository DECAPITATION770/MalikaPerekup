"""Cascade-delete object-storage files for soft-deleted counterparties.

CLAUDE.md §10 promises that PII attachments (passport scans, ID photos)
are removed from MinIO/R2 when the user deletes a counterparty card. The
HTTP layer only flips ``deleted_at``; this job, scheduled hourly,
catches up with the bucket so we never carry orphaned PII.

Algorithm
~~~~~~~~~
1. SELECT counterparties WHERE ``deleted_at IS NOT NULL`` AND
   ``files_cleaned = false``.
2. For each row, iterate ``doc_photos`` (S3 keys) and ``storage.delete``
   them. Storage errors are logged but don't fail the batch — the row
   keeps ``files_cleaned = false`` and we retry next hour.
3. Once **all** keys for a row delete cleanly, mark
   ``files_cleaned = true`` and commit.
"""

from __future__ import annotations

from sqlalchemy import select

from app.common import storage
from app.core.database import SessionFactory
from app.core.logging import logger
from app.features.counterparties.models import Counterparty


async def cleanup_deleted_counterparty_files() -> None:
    """One pass over pending-cleanup counterparties. Idempotent."""
    async with SessionFactory() as db:
        rows = (
            await db.execute(
                select(Counterparty).where(
                    Counterparty.deleted_at.is_not(None),
                    Counterparty.files_cleaned.is_(False),
                )
            )
        ).scalars().all()

        if not rows:
            return

        logger.info("cleanup.counterparty_files.start", pending=len(rows))

        for cp in rows:
            failures = 0
            for key in cp.doc_photos or []:
                try:
                    storage.delete(key)
                except Exception as exc:  # noqa: BLE001 — log + continue
                    failures += 1
                    logger.warning(
                        "cleanup.counterparty_files.s3_delete_failed",
                        counterparty_id=cp.id,
                        key=key,
                        error=str(exc),
                    )

            if failures == 0:
                cp.files_cleaned = True
                logger.info(
                    "cleanup.counterparty_files.row_done",
                    counterparty_id=cp.id,
                    files_removed=len(cp.doc_photos or []),
                )

        await db.commit()
