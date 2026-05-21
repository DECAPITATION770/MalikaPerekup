"""purchases.repository.get_last_with_device — template for "🔁 Повторить".

Powers GET /purchases/last (purchase wizard step 1).
Runs against real PostgreSQL (CLAUDE.md §13).
"""

from datetime import date, timedelta
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.purchases import repository as purchases_repo
from app.features.purchases import service as purchase_service


class _DeviceIn:
    def __init__(self, brand="Apple", model="iPhone 15", defects=None):
        self.category = "phone"
        self.brand = brand
        self.model = model
        self.imei = None
        self.serial = None
        self.condition = "good"
        self.specs = {}
        self.photos = []
        self.defects = defects or []
        self.notes = None


class _SellerIn:
    def __init__(self, full_name="Алишер", phone=None):
        self.full_name = full_name
        self.phone = phone
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


async def _buy(db, *, shop, user, brand="Apple", model="iPhone 15",
               seller_name="Алишер", on_date=None, defects=None):
    di = _DeviceIn(brand=brand, model=model, defects=defects)
    di.imei = next(_IMEI)
    await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=di,
        seller_in=_SellerIn(full_name=seller_name),
        currency="UZS",
        price=Decimal("4000000"),
        exchange_rate=None,
        purchase_date=on_date or date.today(),
        comment=None,
    )
    await db.flush()


async def test_empty_shop_returns_none(db):
    shop, _ = await _make_shop(db, "Empty", 5001)
    row = await purchases_repo.get_last_with_device(db, shop_id=shop.id)
    assert row is None


async def test_returns_most_recent_purchase(db):
    shop, user = await _make_shop(db, "Last", 5002)
    today = date.today()
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 14",
               seller_name="Старый", on_date=today - timedelta(days=5))
    await _buy(db, shop=shop, user=user, brand="Xiaomi", model="Note 13",
               seller_name="Свежий", on_date=today, defects=["scratches"])

    row = await purchases_repo.get_last_with_device(db, shop_id=shop.id)
    assert row is not None
    purchase, device = row
    assert device.brand == "Xiaomi"
    assert device.model == "Note 13"
    assert device.defects == ["scratches"]
    assert purchase.seller_name == "Свежий"


async def test_last_purchase_is_shop_scoped(db):
    shop_a, _ = await _make_shop(db, "A", 5003)
    shop_b, ub = await _make_shop(db, "B", 5004)
    await _buy(db, shop=shop_b, user=ub, brand="Samsung", model="S24")

    assert await purchases_repo.get_last_with_device(db, shop_id=shop_a.id) is None

    row_b = await purchases_repo.get_last_with_device(db, shop_id=shop_b.id)
    assert row_b is not None
    _, device = row_b
    assert device.brand == "Samsung"
