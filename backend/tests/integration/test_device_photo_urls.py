"""GET /devices/{id}/photo-urls — signed download URLs, shop-scoped.

Photos are private (CLAUDE.md §10); this endpoint hands the Mini App
short-lived signed URLs. A foreign device_id must 404, never leak another
shop's photo keys (CLAUDE.md §6).

Uses the same ``authed_client`` pattern as ``test_multi_tenancy`` — it
overrides ``get_db`` so HTTP queries hit the test engine (one event loop),
avoiding the global SessionFactory's cross-loop connection-close crash.
"""

from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_current_user_id
from app.features.admin import service as admin_service
from app.features.purchases import service as purchase_service


class _DeviceIn:
    def __init__(self, photos):
        self.category = "phone"
        self.brand = "Apple"
        self.model = "iPhone 15"
        self.imei = None
        self.serial = None
        self.condition = "good"
        self.specs = {}
        self.photos = photos
        self.defects = []
        self.notes = None


class _SellerIn:
    def __init__(self):
        self.full_name = "S"
        self.phone = None
        self.doc_type = None
        self.doc_number = None
        self.photos = []
        self.tg_username = None


_IMEI = iter(str(n).zfill(15) for n in range(700_001, 710_000))


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


async def _buy(db, *, shop, user, photos):
    di = _DeviceIn(photos)
    di.imei = next(_IMEI)
    _, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=di,
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal("4000000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    await db.flush()
    return device


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
    shop_a, user_a = await _make_shop(db, "A", 7003)  # client default → A
    shop_b, user_b = await _make_shop(db, "B", 7004)
    keys = [f"shops/{shop_a.id}/devices/a-front.jpg", f"shops/{shop_a.id}/devices/b-back.jpg"]
    dev_a = await _buy(db, shop=shop_a, user=user_a, photos=keys)
    dev_a_empty = await _buy(db, shop=shop_a, user=user_a, photos=[])
    dev_b = await _buy(db, shop=shop_b, user=user_b, photos=["shops/x/devices/secret.jpg"])
    await db.commit()
    return {
        "user_a": user_a,
        "user_b": user_b,
        "dev_a": dev_a,
        "dev_a_empty": dev_a_empty,
        "dev_b": dev_b,
    }


async def test_returns_one_url_per_photo(authed_client, fixtures):
    _as(fixtures["user_a"].id)
    resp = await authed_client.get(f"/api/v1/devices/{fixtures['dev_a'].id}/photo-urls")
    assert resp.status_code == 200, resp.text
    urls = resp.json()["urls"]
    assert len(urls) == 2
    assert all(u.startswith("http") for u in urls)


async def test_empty_photos_yields_empty_list(authed_client, fixtures):
    _as(fixtures["user_a"].id)
    resp = await authed_client.get(f"/api/v1/devices/{fixtures['dev_a_empty'].id}/photo-urls")
    assert resp.status_code == 200, resp.text
    assert resp.json()["urls"] == []


async def test_foreign_device_is_404(authed_client, fixtures):
    """Shop B's owner must not get shop A's photo URLs, and vice-versa."""
    _as(fixtures["user_b"].id)
    resp = await authed_client.get(f"/api/v1/devices/{fixtures['dev_a'].id}/photo-urls")
    assert resp.status_code in (403, 404), resp.text
