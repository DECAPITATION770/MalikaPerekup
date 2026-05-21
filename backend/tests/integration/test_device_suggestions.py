"""devices.repository.suggest — shop isolation, brand filter, freq order.

Runs against real PostgreSQL (CLAUDE.md §13). Devices are created the only
way the app creates them — through purchase_service.
"""

from datetime import date
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.devices import repository as device_repo
from app.features.purchases import service as purchase_service


class _DeviceIn:
    def __init__(self, brand, model, imei):
        self.category = "phone"
        self.brand = brand
        self.model = model
        self.imei = imei
        self.serial = None
        self.condition = "good"
        self.specs = {}
        self.photos = []
        self.defects = []
        self.notes = None


class _SellerIn:
    def __init__(self):
        self.full_name = "Seller"
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


async def _buy(db, *, shop, user, brand, model):
    await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(brand=brand, model=model, imei=next(_IMEI)),
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal("1000000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    await db.flush()


async def test_brand_suggestions_are_shop_scoped(db):
    shop_a, ua = await _make_shop(db, "A", 8001)
    shop_b, ub = await _make_shop(db, "B", 8002)

    await _buy(db, shop=shop_a, user=ua, brand="Apple", model="iPhone 13")
    await _buy(db, shop=shop_b, user=ub, brand="Samsung", model="Galaxy S21")

    a = await device_repo.suggest(
        db, shop_id=shop_a.id, field="brand", q="", brand=None, limit=8
    )
    assert a == ["Apple"]  # Samsung from shop B must not leak in

    b = await device_repo.suggest(
        db, shop_id=shop_b.id, field="brand", q="", brand=None, limit=8
    )
    assert b == ["Samsung"]


async def test_brand_ordered_by_frequency(db):
    shop, user = await _make_shop(db, "Freq", 8003)
    for _ in range(3):
        await _buy(db, shop=shop, user=user, brand="Xiaomi", model="Redmi")
    await _buy(db, shop=shop, user=user, brand="Nokia", model="3310")

    res = await device_repo.suggest(
        db, shop_id=shop.id, field="brand", q="", brand=None, limit=8
    )
    assert res == ["Xiaomi", "Nokia"]  # most-used first


async def test_brand_prefix_filter(db):
    shop, user = await _make_shop(db, "Pref", 8004)
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 12")
    await _buy(db, shop=shop, user=user, brand="Asus", model="Zenfone")
    await _buy(db, shop=shop, user=user, brand="Nokia", model="3310")

    res = await device_repo.suggest(
        db, shop_id=shop.id, field="brand", q="a", brand=None, limit=8
    )
    assert set(res) == {"Apple", "Asus"}


async def test_model_filtered_by_brand(db):
    shop, user = await _make_shop(db, "Models", 8005)
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 13")
    await _buy(db, shop=shop, user=user, brand="Apple", model="iPhone 14")
    await _buy(db, shop=shop, user=user, brand="Samsung", model="Galaxy S21")

    apple = await device_repo.suggest(
        db, shop_id=shop.id, field="model", q="", brand="Apple", limit=8
    )
    assert set(apple) == {"iPhone 13", "iPhone 14"}
    assert "Galaxy S21" not in apple

    # Without a brand filter the model list spans every brand.
    all_models = await device_repo.suggest(
        db, shop_id=shop.id, field="model", q="", brand=None, limit=8
    )
    assert set(all_models) == {"iPhone 13", "iPhone 14", "Galaxy S21"}
