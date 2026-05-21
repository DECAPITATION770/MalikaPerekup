"""exchange_rate_hint — shop isolation for last_used, stale flag for cb_uz.

Runs against real PostgreSQL (CLAUDE.md §13). Uses the same service-level
helpers as test_full_cycle rather than the HTTP layer.
"""

from datetime import date, timedelta
from decimal import Decimal

from app.common.dates import today_tashkent
from app.features.admin import service as admin_service
from app.features.exchange import repository as exchange_repo
from app.features.exchange import service as exchange_service
from app.features.purchases import service as purchase_service


class _DeviceIn:
    def __init__(self, imei=None):
        self.category = "phone"
        self.brand = "Apple"
        self.model = "iPhone 13"
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


async def _make_shop(db, name: str, tg_id: int):
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


async def _usd_purchase(db, *, shop, user, rate: str, when: date, imei: str):
    await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei=imei),
        seller_in=_SellerIn(),
        currency="USD",
        price=Decimal("100.00"),
        exchange_rate=Decimal(rate),
        purchase_date=when,
        comment=None,
    )
    await db.flush()


async def test_no_data_returns_both_null(db):
    shop, _ = await _make_shop(db, "Empty", 7001)
    hint = await exchange_service.exchange_rate_hint(db, shop_id=shop.id)
    assert hint.last_used is None
    assert hint.cb_uz is None


async def test_cbu_today_is_not_stale(db):
    shop, _ = await _make_shop(db, "CbuFresh", 7002)
    today = today_tashkent()
    await exchange_repo.upsert_cbu_rate(
        db, rate_date=today, usd_rate=Decimal("12846.43")
    )
    await db.flush()

    hint = await exchange_service.exchange_rate_hint(db, shop_id=shop.id)
    assert hint.cb_uz is not None
    assert hint.cb_uz.rate == Decimal("12846.43")
    assert hint.cb_uz.as_of == today
    assert hint.cb_uz.stale is False


async def test_cbu_past_date_is_stale(db):
    shop, _ = await _make_shop(db, "CbuStale", 7003)
    old = today_tashkent() - timedelta(days=3)
    await exchange_repo.upsert_cbu_rate(
        db, rate_date=old, usd_rate=Decimal("12000.00")
    )
    await db.flush()

    hint = await exchange_service.exchange_rate_hint(db, shop_id=shop.id)
    assert hint.cb_uz is not None
    assert hint.cb_uz.stale is True


async def test_last_used_is_shop_scoped(db):
    """Shop B's USD deal must never leak into Shop A's hint (CLAUDE.md §6)."""
    shop_a, user_a = await _make_shop(db, "A", 7004)
    shop_b, user_b = await _make_shop(db, "B", 7005)

    await _usd_purchase(
        db, shop=shop_b, user=user_b,
        rate="13000", when=today_tashkent(), imei="111111111111111",
    )

    hint_a = await exchange_service.exchange_rate_hint(db, shop_id=shop_a.id)
    assert hint_a.last_used is None

    hint_b = await exchange_service.exchange_rate_hint(db, shop_id=shop_b.id)
    assert hint_b.last_used is not None
    assert hint_b.last_used.rate == Decimal("13000")
    assert hint_b.last_used.stale is False


async def test_last_used_picks_most_recent_purchase(db):
    shop, user = await _make_shop(db, "Recent", 7006)
    today = today_tashkent()
    await _usd_purchase(
        db, shop=shop, user=user,
        rate="12500", when=today - timedelta(days=10), imei="222222222222222",
    )
    await _usd_purchase(
        db, shop=shop, user=user,
        rate="12900", when=today, imei="333333333333333",
    )

    hint = await exchange_service.exchange_rate_hint(db, shop_id=shop.id)
    assert hint.last_used is not None
    assert hint.last_used.rate == Decimal("12900")
    assert hint.last_used.as_of == today
