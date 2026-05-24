"""Counterparty documents: upload-url + signed GET doc-urls, shop-scoped.

Documents (passport scans, photos, PDFs — any file type) are private PII
(CLAUDE.md §10). ``POST /counterparties/upload-url`` signs a short-lived PUT;
``GET /counterparties/{id}/doc-urls`` signs short-lived GETs. A foreign id
must 404, never leak another shop's document keys (CLAUDE.md §6).

Reuses the ``authed_client`` override pattern from ``test_device_photo_urls``.
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_current_user_id
from app.features.admin import service as admin_service
from app.features.counterparties import repository as cp_repo


async def _make_shop(db, name, tg_id):
    shop, user = await admin_service.register_shop_with_owner(
        db,
        name=name,
        language_default="ru",
        owner_full_name=f"Owner {name}",
        owner_tg_id=tg_id,
        owner_tg_username=None,
        owner_phone=None,
        owner_login=None,
        owner_password=None,
    )
    await db.flush()
    return shop, user


_AUTHED_USER_ID: dict[str, int | None] = {"id": None}


def _as(user_id: int) -> None:
    _AUTHED_USER_ID["id"] = user_id


@pytest.fixture
async def authed_client(engine):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.database import get_db
    from app.main import app

    async def _override_user_id(authorization: str | None = None) -> int:  # noqa: ARG001
        from fastapi import HTTPException, status

        uid = _AUTHED_USER_ID["id"]
        if uid is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no test user set")
        return uid

    test_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async def _override_db():
        async with test_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_current_user_id] = _override_user_id
    app.dependency_overrides[get_db] = _override_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_current_user_id, None)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def fixtures(db):
    shop_a, user_a = await _make_shop(db, "A", 7103)
    shop_b, user_b = await _make_shop(db, "B", 7104)
    cp_a = await cp_repo.create(
        db,
        shop_id=shop_a.id,
        type="seller",
        full_name="Seller A",
        phone="+998900000001",
        doc_type="passport",
        doc_number="AA1234567",
        doc_photos=[
            f"shops/{shop_a.id}/counterparties/{'a' * 32}-passport.pdf",
            f"shops/{shop_a.id}/counterparties/{'b' * 32}-scan.jpg",
        ],
        tg_username=None,
    )
    cp_a_empty = await cp_repo.create(
        db,
        shop_id=shop_a.id,
        type="buyer",
        full_name="Buyer A",
        phone="+998900000002",
        doc_type=None,
        doc_number=None,
        doc_photos=[],
        tg_username=None,
    )
    await db.commit()
    return {"user_a": user_a, "user_b": user_b, "cp_a": cp_a, "cp_a_empty": cp_a_empty}


async def test_doc_urls_one_file_per_key(authed_client, fixtures):
    _as(fixtures["user_a"].id)
    resp = await authed_client.get(
        f"/api/v1/counterparties/{fixtures['cp_a'].id}/doc-urls"
    )
    assert resp.status_code == 200, resp.text
    files = resp.json()["files"]
    assert len(files) == 2
    assert all(f["url"].startswith("http") for f in files)
    # uuid prefix is stripped → human filename survives, including non-image types
    names = {f["name"] for f in files}
    assert names == {"passport.pdf", "scan.jpg"}


async def test_doc_urls_empty(authed_client, fixtures):
    _as(fixtures["user_a"].id)
    resp = await authed_client.get(
        f"/api/v1/counterparties/{fixtures['cp_a_empty'].id}/doc-urls"
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["files"] == []


async def test_foreign_counterparty_docs_404(authed_client, fixtures):
    """Shop B's owner must not get shop A's document URLs."""
    _as(fixtures["user_b"].id)
    resp = await authed_client.get(
        f"/api/v1/counterparties/{fixtures['cp_a'].id}/doc-urls"
    )
    assert resp.status_code in (403, 404), resp.text


async def test_upload_url_returns_scoped_key(authed_client, fixtures):
    _as(fixtures["user_a"].id)
    resp = await authed_client.post(
        "/api/v1/counterparties/upload-url", json={"filename": "passport.pdf"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["url"].startswith("http")
    assert "/counterparties/" in body["key"]
    assert body["key"].endswith("passport.pdf")
