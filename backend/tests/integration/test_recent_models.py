"""devices.repository.recent_models — shop isolation, dedup, recency order.

Powers GET /devices/recent-models (purchase wizard step 1).
Runs against real PostgreSQL (CLAUDE.md §13).
"""

from datetime import date
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.devices import repository as device_repo
from app.features.purchases import service as purchase_service


class _DeviceIn:
    def __init__(self, brand="Apple", model="iPhone 13", category="phone"):
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


async def _buy(db, *, shop, user, brand, model, category="phone"):
    di = _DeviceIn(brand=brand, model=model, category=category)
    di.imei = next(_IMEI)
    await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=di,
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal("1000000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    await db.flush()


async def test_recent_models_are_shop_scoped(db):
    shop_a, ua = await _make_shop(db, "A", 7001)
    shop_b, ub = await _make_shop(db, "B", 7002)

    await _buy(db, shop=shop_a, user=ua, brand="Apple", model="iPhone 15")
    await _buy(db, shop=shop_b, user=ub, brand="Samsung", model="Galaxy S24")

    a = await device_repo.recent_models(db, shop_id=shop_a.id, limit=10)
    assert a == [("Apple", "iPhone 15", "phone")]

    b = await device_repo.recent_models(db, shop_id=shop_b.id, limit=10)
    assert b == [("Samsung", "Galaxy S24", "phone")]


async def test_recent_models_deduplicate_repeated_purchases(db):
    """5 iPhone 15 + 1 Note 13 → 2 chips, not 6."""
    shop, user = await _make_shop(db, "Dedup", 7003)
    for _ in range(5):
        await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 15")
    await _buy(db, shop=shop, user=user, brand="Xiaomi", model="Note 13")

    rows = await device_repo.recent_models(db, shop_id=shop.id, limit=10)
    assert len(rows) == 2
    pairs = {(b, m) for b, m, _ in rows}
    assert pairs == {("Apple", "iPhone 15"), ("Xiaomi", "Note 13")}


async def test_recent_models_ordered_by_recency(db):
    """Most recently purchased model comes first."""
    shop, user = await _make_shop(db, "Order", 7004)
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 14")
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 15")
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 13")

    rows = await device_repo.recent_models(db, shop_id=shop.id, limit=10)
    models = [m for _, m, _ in rows]
    assert models == ["iPhone 13", "iPhone 15", "iPhone 14"]


async def test_recent_models_respect_limit(db):
    shop, user = await _make_shop(db, "Limit", 7005)
    for i in range(15):
        await _buy(db, shop=shop, user=user, brand=f"Brand{i}", model="X")

    rows = await device_repo.recent_models(db, shop_id=shop.id, limit=10)
    assert len(rows) == 10


async def test_recent_models_empty_shop_returns_empty_list(db):
    shop, _ = await _make_shop(db, "Empty", 7006)
    rows = await device_repo.recent_models(db, shop_id=shop.id, limit=10)
    assert rows == []
