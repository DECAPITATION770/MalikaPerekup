"""purchases.repository.price_hint — last/avg price for brand+model, shop-scoped.

Powers GET /devices/price-hint (purchase wizard step 4).
Runs against real PostgreSQL (CLAUDE.md §13).
"""

from datetime import date, timedelta
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.purchases import repository as purchases_repo
from app.features.purchases import service as purchase_service


class _DeviceIn:
    def __init__(self, brand="Apple", model="iPhone 15"):
        self.category = "phone"
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


async def _buy_uzs(db, *, shop, user, brand, model, price, on_date=None):
    di = _DeviceIn(brand=brand, model=model)
    di.imei = next(_IMEI)
    await purchase_service.create_purchase(
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


async def test_empty_history_returns_zero_count(db):
    shop, _ = await _make_shop(db, "Empty", 6001)
    count, last, avg = await purchases_repo.price_hint(
        db, shop_id=shop.id, brand="Apple", model="iPhone 15"
    )
    assert count == 0
    assert last is None
    assert avg is None


async def test_single_purchase_returns_same_for_last_and_avg(db):
    shop, user = await _make_shop(db, "One", 6002)
    await _buy_uzs(db, shop=shop, user=user, brand="Apple", model="iPhone 15", price="4000000")
    count, last, avg = await purchases_repo.price_hint(
        db, shop_id=shop.id, brand="Apple", model="iPhone 15"
    )
    assert count == 1
    assert last == Decimal("4000000.00")
    assert avg == Decimal("4000000.00")


async def test_avg_and_last_differ_on_history(db):
    """3 buys at 4M / 4.4M / 4.2M (in that date order) → last=4.2M, avg=4.2M."""
    shop, user = await _make_shop(db, "Hist", 6003)
    today = date.today()
    await _buy_uzs(db, shop=shop, user=user, brand="Apple", model="iPhone 15",
                   price="4000000", on_date=today - timedelta(days=10))
    await _buy_uzs(db, shop=shop, user=user, brand="Apple", model="iPhone 15",
                   price="4400000", on_date=today - timedelta(days=5))
    await _buy_uzs(db, shop=shop, user=user, brand="Apple", model="iPhone 15",
                   price="4200000", on_date=today)

    count, last, avg = await purchases_repo.price_hint(
        db, shop_id=shop.id, brand="Apple", model="iPhone 15"
    )
    assert count == 3
    assert last == Decimal("4200000.00")
    assert avg == Decimal("4200000.00")  # (4M + 4.4M + 4.2M) / 3


async def test_price_hint_is_shop_scoped(db):
    """Shop A must not see prices from shop B (CLAUDE.md §6)."""
    shop_a, ua = await _make_shop(db, "A", 6004)
    shop_b, ub = await _make_shop(db, "B", 6005)

    await _buy_uzs(db, shop=shop_b, user=ub, brand="Apple", model="iPhone 15", price="3500000")

    a = await purchases_repo.price_hint(db, shop_id=shop_a.id, brand="Apple", model="iPhone 15")
    assert a == (0, None, None)

    count, last, _ = await purchases_repo.price_hint(
        db, shop_id=shop_b.id, brand="Apple", model="iPhone 15"
    )
    assert count == 1
    assert last == Decimal("3500000.00")


async def test_price_hint_case_insensitive(db):
    """'iPhone 15' and 'iphone 15' should share history."""
    shop, user = await _make_shop(db, "Case", 6006)
    await _buy_uzs(db, shop=shop, user=user, brand="Apple", model="iPhone 15", price="4000000")
    count, _, _ = await purchases_repo.price_hint(
        db, shop_id=shop.id, brand="apple", model="iphone 15"
    )
    assert count == 1


async def test_different_models_have_separate_history(db):
    shop, user = await _make_shop(db, "Sep", 6007)
    await _buy_uzs(db, shop=shop, user=user, brand="Apple", model="iPhone 15", price="4000000")
    await _buy_uzs(db, shop=shop, user=user, brand="Apple", model="iPhone 14", price="3000000")

    c15, _, _ = await purchases_repo.price_hint(db, shop_id=shop.id, brand="Apple", model="iPhone 15")
    c14, _, _ = await purchases_repo.price_hint(db, shop_id=shop.id, brand="Apple", model="iPhone 14")
    assert c15 == 1
    assert c14 == 1
