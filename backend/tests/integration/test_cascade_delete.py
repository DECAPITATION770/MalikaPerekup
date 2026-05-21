"""S3 cascade-delete worker (``cleanup_deleted_counterparty_files``) —
CLAUDE.md §10. Soft-delete sets ``deleted_at`` on a row; this hourly job
purges the linked photo keys from object storage and flips
``files_cleaned = true``.

Test strategy
~~~~~~~~~~~~~
* Real Postgres (via conftest), but storage.delete is monkeypatched so
  we don't depend on a running MinIO during CI. We record every key the
  job tries to remove and assert the set matches what was stored on the
  row.
* If S3 errors are raised for a key, the row stays unflushed and the
  worker retries on the next pass.
"""

from datetime import datetime, timezone

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.common import storage
from app.features.admin import service as admin_service
from app.features.counterparties.models import Counterparty
from bot.jobs import cleanup_deleted_files


@pytest.fixture
def fake_s3(monkeypatch):
    """Capture every ``storage.delete`` call instead of hitting MinIO."""
    deleted: list[str] = []

    def _delete(key: str) -> None:
        deleted.append(key)

    monkeypatch.setattr(storage, "delete", _delete)
    monkeypatch.setattr(cleanup_deleted_files.storage, "delete", _delete)
    return deleted


@pytest.fixture
def use_test_engine(engine, monkeypatch):
    """Make the worker reuse the test's engine instead of the prod
    SessionFactory (whose engine lives on a different event loop and would
    crash on connection close).
    """
    test_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)
    monkeypatch.setattr(cleanup_deleted_files, "SessionFactory", test_factory)
    return test_factory


async def _seed_shop_owner(db: AsyncSession):
    """Pre-fab: one user owning one shop (FK targets for counterparties).

    Reuses the platform-admin registration path so the cyclic
    users/shops FK doesn't bite — same approach as ``test_full_cycle``.
    """
    shop, user = await admin_service.register_shop_with_owner(
        db,
        name="Test Shop",
        language_default="ru",
        owner_full_name="Test Owner",
        owner_tg_id=42,
        owner_tg_username=None,
        owner_phone=None,
        owner_login=None,
        owner_password=None,
    )
    await db.commit()
    return shop, user


async def test_cleanup_removes_files_and_flips_flag(
    db: AsyncSession, fake_s3: list[str], use_test_engine
):
    shop, _ = await _seed_shop_owner(db)
    cp = Counterparty(
        shop_id=shop.id,
        type="seller",
        full_name="Иван Иванов",
        phone="+998900000001",
        doc_photos=[
            f"shops/{shop.id}/counterparty/aaa.jpg",
            f"shops/{shop.id}/counterparty/bbb.jpg",
        ],
        deleted_at=datetime.now(tz=timezone.utc),
    )
    db.add(cp)
    await db.commit()

    await cleanup_deleted_files.cleanup_deleted_counterparty_files()

    await db.refresh(cp)
    assert cp.files_cleaned is True
    assert set(fake_s3) == {
        f"shops/{shop.id}/counterparty/aaa.jpg",
        f"shops/{shop.id}/counterparty/bbb.jpg",
    }


async def test_cleanup_skips_alive_counterparties(
    db: AsyncSession, fake_s3: list[str], use_test_engine
):
    shop, _ = await _seed_shop_owner(db)
    alive = Counterparty(
        shop_id=shop.id,
        type="buyer",
        full_name="Активный клиент",
        doc_photos=["shops/x/counterparty/zzz.jpg"],
        deleted_at=None,
    )
    db.add(alive)
    await db.commit()

    await cleanup_deleted_files.cleanup_deleted_counterparty_files()

    await db.refresh(alive)
    assert alive.files_cleaned is False
    assert fake_s3 == []


async def test_cleanup_retries_when_s3_fails(
    db: AsyncSession, use_test_engine, monkeypatch
):
    shop, _ = await _seed_shop_owner(db)
    cp = Counterparty(
        shop_id=shop.id,
        type="seller",
        full_name="Сбойный",
        doc_photos=[f"shops/{shop.id}/counterparty/broken.jpg"],
        deleted_at=datetime.now(tz=timezone.utc),
    )
    db.add(cp)
    await db.commit()

    def _failing_delete(_key: str) -> None:
        raise RuntimeError("simulated S3 timeout")

    monkeypatch.setattr(storage, "delete", _failing_delete)
    monkeypatch.setattr(cleanup_deleted_files.storage, "delete", _failing_delete)

    await cleanup_deleted_files.cleanup_deleted_counterparty_files()

    await db.refresh(cp)
    # Row stays in the queue — we'll retry next hour.
    assert cp.files_cleaned is False


async def test_cleanup_no_op_when_queue_empty(
    db: AsyncSession, fake_s3: list[str], use_test_engine
):
    # No fixtures — schema's truncated between tests.
    await cleanup_deleted_files.cleanup_deleted_counterparty_files()
    assert fake_s3 == []
