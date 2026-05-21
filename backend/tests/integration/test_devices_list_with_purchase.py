"""devices.repository.search_with_purchase — JOIN device + purchase for Stock.

Powers the Stock table on the Mini App. Runs against real PostgreSQL.
"""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import update

from app.features.admin import service as admin_service
from app.features.devices import repository as device_repo
from app.features.devices.models import Device
from app.features.purchases import service as purchase_service


class _DeviceIn:
    def __init__(self, brand="Apple", model="iPhone 15", category="phone"):
        self.category = category
        self.brand = brand
        self.model = model
        self.imei = None
        self.serial = None
        self.condition = "good"
        self.specs = {}
        self.photos = []
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


_IMEI = iter(str(n).zfill(15) for n in range(1, 10_000))


async def _buy(db, *, shop, user, brand="Apple", model="iPhone 15", price="4000000",
               category="phone", on_date=None):
    di = _DeviceIn(brand=brand, model=model, category=category)
    di.imei = next(_IMEI)
    purchase, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=di,
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal(price),
        exchange_rate=None,
        purchase_date=on_date or date.today(),
        comment=None,
    )
    await db.flush()
    return purchase, device


async def test_list_carries_price_and_date(db):
    shop, user = await _make_shop(db, "P", 4001)
    today = date.today()
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 15",
               price="4200000", on_date=today)

    rows, total = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category=None,
        limit=20, offset=0,
    )
    assert total == 1
    assert len(rows) == 1
    device, price, p_date = rows[0]
    assert device.brand == "Apple"
    assert price == Decimal("4200000.00")
    assert p_date == today


async def test_list_is_shop_scoped(db):
    """Shop A must not see devices from shop B (CLAUDE.md §6)."""
    shop_a, _ = await _make_shop(db, "A", 4002)
    shop_b, ub = await _make_shop(db, "B", 4003)
    await _buy(db, shop=shop_b, user=ub, brand="Samsung", model="S24")

    rows_a, total_a = await device_repo.search_with_purchase(
        db, shop_id=shop_a.id, query=None, status=None, category=None,
        limit=20, offset=0,
    )
    assert total_a == 0
    assert rows_a == []

    rows_b, total_b = await device_repo.search_with_purchase(
        db, shop_id=shop_b.id, query=None, status=None, category=None,
        limit=20, offset=0,
    )
    assert total_b == 1


async def test_list_respects_filters(db):
    shop, user = await _make_shop(db, "F", 4004)
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 15", category="phone")
    await _buy(db, shop=shop, user=user, brand="Apple", model="MacBook Air", category="laptop")
    await _buy(db, shop=shop, user=user, brand="Samsung", model="Galaxy Tab", category="tablet")

    # category filter
    rows, _ = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category="laptop",
        limit=20, offset=0,
    )
    assert len(rows) == 1
    assert rows[0][0].model == "MacBook Air"

    # free-text query
    rows, _ = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query="iPhone", status=None, category=None,
        limit=20, offset=0,
    )
    assert len(rows) == 1
    assert rows[0][0].model == "iPhone 15"


async def test_days_in_stock_from_router(db, client):
    """End-to-end via the router so we exercise the date math too."""
    shop, user = await _make_shop(db, "Days", 4005)
    _, device = await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 15")
    # Backdate created_at by 5 days to assert days_in_stock is computed.
    five_days_ago = datetime.now(timezone.utc) - timedelta(days=5)
    await db.execute(
        update(Device).where(Device.id == device.id).values(created_at=five_days_ago)
    )
    await db.commit()

    resp = await client.get("/api/v1/devices")
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["brand"] == "Apple"
    assert row["purchase_price_uzs"] == "4000000.00"
    # 5±1 to tolerate the UTC date-boundary (server uses UTC; test runs anywhere).
    assert row["days_in_stock"] in (4, 5, 6)
