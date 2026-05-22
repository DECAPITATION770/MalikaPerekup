"""devices.repository.search_with_purchase — condition/brand/price/sort filters.

Powers the new Stock filters. Repository-level (real Postgres), mirroring
test_devices_list_with_purchase.py. Every filter must stay shop-scoped
(CLAUDE.md §6).
"""

from datetime import date
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.devices import repository as device_repo
from app.features.purchases import service as purchase_service


class _DeviceIn:
    def __init__(self, brand="Apple", model="iPhone 15", category="phone", condition="good"):
        self.category = category
        self.brand = brand
        self.model = model
        self.imei = None
        self.serial = None
        self.condition = condition
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


_IMEI = iter(str(n).zfill(15) for n in range(800_001, 810_000))


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


async def _buy(db, *, shop, user, brand="Apple", model="iPhone 15",
               price="4000000", category="phone", condition="good"):
    di = _DeviceIn(brand=brand, model=model, category=category, condition=condition)
    di.imei = next(_IMEI)
    _, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=di,
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal(price),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    await db.flush()
    return device


def _ids(rows):
    return [d.id for d, _price, _date in rows]


async def test_condition_filter(db):
    shop, user = await _make_shop(db, "C", 8001)
    await _buy(db, shop=shop, user=user, condition="good")
    broken = await _buy(db, shop=shop, user=user, condition="broken")

    rows, total = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category=None,
        condition="broken", limit=20, offset=0,
    )
    assert total == 1
    assert _ids(rows) == [broken.id]


async def test_brand_filter_is_case_insensitive(db):
    shop, user = await _make_shop(db, "B", 8002)
    apple = await _buy(db, shop=shop, user=user, brand="Apple")
    await _buy(db, shop=shop, user=user, brand="Samsung", model="S24")

    rows, total = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category=None,
        brand="apple", limit=20, offset=0,
    )
    assert total == 1
    assert _ids(rows) == [apple.id]


async def test_price_range_filter(db):
    shop, user = await _make_shop(db, "P", 8003)
    await _buy(db, shop=shop, user=user, price="1000000")
    mid = await _buy(db, shop=shop, user=user, price="4000000")
    await _buy(db, shop=shop, user=user, price="9000000")

    rows, total = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category=None,
        price_min=Decimal("2000000"), price_max=Decimal("5000000"),
        limit=20, offset=0,
    )
    assert total == 1
    assert _ids(rows) == [mid.id]


async def test_sort_by_price(db):
    shop, user = await _make_shop(db, "S", 8004)
    d9 = await _buy(db, shop=shop, user=user, price="9000000")
    d1 = await _buy(db, shop=shop, user=user, price="1000000")
    d4 = await _buy(db, shop=shop, user=user, price="4000000")

    asc, _ = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category=None,
        sort="price_asc", limit=20, offset=0,
    )
    assert _ids(asc) == [d1.id, d4.id, d9.id]

    desc, _ = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category=None,
        sort="price_desc", limit=20, offset=0,
    )
    assert _ids(desc) == [d9.id, d4.id, d1.id]


async def test_sort_recent_vs_days(db):
    """recent = newest first; days = oldest first (longest in stock)."""
    shop, user = await _make_shop(db, "O", 8005)
    first = await _buy(db, shop=shop, user=user)
    second = await _buy(db, shop=shop, user=user)
    third = await _buy(db, shop=shop, user=user)

    recent, _ = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category=None,
        sort="recent", limit=20, offset=0,
    )
    assert _ids(recent) == [third.id, second.id, first.id]

    days, _ = await device_repo.search_with_purchase(
        db, shop_id=shop.id, query=None, status=None, category=None,
        sort="days", limit=20, offset=0,
    )
    assert _ids(days) == [first.id, second.id, third.id]


async def test_filters_are_shop_scoped(db):
    """A filter on shop A must never surface shop B's devices (CLAUDE.md §6)."""
    shop_a, _ = await _make_shop(db, "A", 8006)
    shop_b, ub = await _make_shop(db, "B", 8007)
    await _buy(db, shop=shop_b, user=ub, brand="Apple", condition="broken", price="4000000")

    rows, total = await device_repo.search_with_purchase(
        db, shop_id=shop_a.id, query=None, status=None, category=None,
        brand="apple", condition="broken", price_min=Decimal("1"),
        limit=20, offset=0,
    )
    assert total == 0
    assert rows == []
