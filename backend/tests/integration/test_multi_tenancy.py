"""Cross-shop isolation — CLAUDE.md §6.

Confirms that a user authenticated as shop A's owner cannot reach shop
B's data via the HTTP layer, even though the underlying tables share a
schema. Every protected GET-by-id must return 404 (or 403) when the
``shop_id`` filter excludes the requested row.

Setup
~~~~~
* Two shops with two owners.
* Each shop has its own counterparty + device + sale.
* Auth is mocked via FastAPI ``dependency_overrides`` so a single
  ``X-Test-User`` header swaps the authenticated user, avoiding JWT
  plumbing inside the test.
"""

from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_current_user_id
from app.features.admin import service as admin_service
from app.features.counterparties.models import Counterparty
from app.features.purchases import service as purchase_service
from app.features.sales import service as sale_service


class _DeviceIn:
    def __init__(self, **kw):
        self.category = kw.get("category", "phone")
        self.brand = kw.get("brand", "Samsung")
        self.model = kw.get("model", "Galaxy A55")
        self.imei = kw.get("imei")
        self.serial = kw.get("serial")
        self.condition = kw.get("condition", "good")
        self.specs = kw.get("specs", {})
        self.photos = kw.get("photos", [])
        self.defects = kw.get("defects", [])
        self.notes = kw.get("notes")


class _PersonIn:
    def __init__(self, full_name="Person", phone=None, **kw):
        self.full_name = full_name
        self.phone = phone
        self.doc_type = kw.get("doc_type")
        self.doc_number = kw.get("doc_number")
        self.photos = kw.get("photos", [])
        self.tg_username = kw.get("tg_username")


@pytest.fixture
async def two_shops(db):
    """Two independent shops with their own owners + a populated dataset each."""
    shop_a, user_a = await admin_service.register_shop_with_owner(
        db,
        name="Shop A",
        language_default="ru",
        owner_full_name="Owner A",
        owner_tg_id=1001,
        owner_tg_username=None,
        owner_phone=None,
        owner_login=None,
        owner_password=None,
    )
    shop_b, user_b = await admin_service.register_shop_with_owner(
        db,
        name="Shop B",
        language_default="ru",
        owner_full_name="Owner B",
        owner_tg_id=1002,
        owner_tg_username=None,
        owner_phone=None,
        owner_login=None,
        owner_password=None,
    )
    await db.flush()

    # Shop A: one purchase → device + one cash sale.
    purchase_a, device_a = await purchase_service.create_purchase(
        db,
        shop_id=shop_a.id,
        user_id=user_a.id,
        device_in=_DeviceIn(imei="aaa-A"),
        seller_in=_PersonIn(full_name="Seller A", phone="+998900000001"),
        currency="UZS",
        price=Decimal("1000000"),
        purchase_date=date.today(),
        exchange_rate=None,
        comment=None,
    )
    sale_a, _ = await sale_service.create_sale(
        db,
        shop_id=shop_a.id,
        user_id=user_a.id,
        device_id=device_a.id,
        buyer_in=_PersonIn(full_name="Buyer A", phone="+998900000002"),
        sale_type="cash",
        currency="UZS",
        price=Decimal("1200000"),
        sale_date=date.today(),
        exchange_rate=None,
        comment=None,
    )

    # Shop B: own purchase + counterparty, no overlap with A.
    purchase_b, device_b = await purchase_service.create_purchase(
        db,
        shop_id=shop_b.id,
        user_id=user_b.id,
        device_in=_DeviceIn(imei="bbb-B"),
        seller_in=_PersonIn(full_name="Seller B", phone="+998900000003"),
        currency="UZS",
        price=Decimal("500000"),
        purchase_date=date.today(),
        exchange_rate=None,
        comment=None,
    )
    await db.commit()

    cp_a = (await db.get(Counterparty, purchase_a.counterparty_id)) if purchase_a.counterparty_id else None

    return {
        "shop_a": shop_a,
        "user_a": user_a,
        "device_a": device_a,
        "sale_a": sale_a,
        "counterparty_a": cp_a,
        "shop_b": shop_b,
        "user_b": user_b,
        "device_b": device_b,
        "purchase_b": purchase_b,
    }


@pytest.fixture
async def authed_client(engine):
    """Client where ``_AUTHED_USER_ID`` controls the authenticated user.

    Overrides both ``get_current_user_id`` (auth bypass) AND ``get_db``
    (so HTTP-layer queries land on the test engine instead of the global
    SessionFactory's engine, which lives on a different event loop and
    would crash on connection close).
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.database import get_db
    from app.main import app

    async def _override_user_id(authorization: str | None = None) -> int:  # noqa: ARG001
        from fastapi import HTTPException, status

        return _AUTHED_USER_ID["id"] or _raise(
            HTTPException(status.HTTP_401_UNAUTHORIZED, "no test user set")
        )

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


def _raise(exc):  # tiny helper so the override stays single-expression
    raise exc


_AUTHED_USER_ID: dict[str, int | None] = {"id": None}


def _as(user_id: int) -> None:
    _AUTHED_USER_ID["id"] = user_id


# ── Tests ──────────────────────────────────────────────────────────────


async def test_user_b_cannot_read_shop_a_device(authed_client, two_shops):
    device_a_id = two_shops["device_a"].id

    _as(two_shops["user_a"].id)
    r = await authed_client.get(f"/api/v1/devices/{device_a_id}")
    assert r.status_code == 200

    _as(two_shops["user_b"].id)
    r = await authed_client.get(f"/api/v1/devices/{device_a_id}")
    assert r.status_code in (403, 404), r.text


async def test_user_b_cannot_read_shop_a_sale(authed_client, two_shops):
    sale_a_id = two_shops["sale_a"].id

    _as(two_shops["user_a"].id)
    r = await authed_client.get(f"/api/v1/sales/{sale_a_id}")
    assert r.status_code == 200

    _as(two_shops["user_b"].id)
    r = await authed_client.get(f"/api/v1/sales/{sale_a_id}")
    assert r.status_code in (403, 404), r.text


async def test_user_b_cannot_read_shop_a_counterparty(authed_client, two_shops):
    cp = two_shops["counterparty_a"]
    if cp is None:
        pytest.skip("purchase service did not create a counterparty row")

    _as(two_shops["user_a"].id)
    r = await authed_client.get(f"/api/v1/counterparties/{cp.id}")
    assert r.status_code == 200

    _as(two_shops["user_b"].id)
    r = await authed_client.get(f"/api/v1/counterparties/{cp.id}")
    assert r.status_code in (403, 404), r.text


async def test_user_b_list_devices_returns_only_shop_b(authed_client, two_shops):
    _as(two_shops["user_b"].id)
    r = await authed_client.get("/api/v1/devices?limit=50")
    assert r.status_code == 200, r.text
    body = r.json()
    items = body.get("items") if isinstance(body, dict) else body
    assert items, "shop B should at least have its own device"
    for item in items:
        # No device from shop A should leak into B's listing.
        assert item["id"] != two_shops["device_a"].id


async def test_today_dashboard_is_shop_scoped(authed_client, two_shops):
    _as(two_shops["user_a"].id)
    ra = await authed_client.get("/api/v1/reports/today")
    assert ra.status_code == 200, ra.text
    a = ra.json()

    _as(two_shops["user_b"].id)
    rb = await authed_client.get("/api/v1/reports/today")
    assert rb.status_code == 200, rb.text
    b = rb.json()

    # Shop A made a sale today, shop B did not — counters must differ.
    assert a.get("sales_count_today", 0) >= 1
    assert b.get("sales_count_today", 0) == 0
