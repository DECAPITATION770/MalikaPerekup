"""Backing query for GET /reports/today — the profit_yesterday delta.

The headline KPI shows a ↑/↓ signal by comparing today's profit to
yesterday's. The regression-worthy behaviour is that the two numbers are
computed from the right ``sale_date`` buckets and stay shop-isolated —
tested directly against real PostgreSQL (CLAUDE.md §6, §13).
"""

from datetime import date
from decimal import Decimal

from app.common.dates import days_ago
from app.features.admin import service as admin_service
from app.features.purchases import service as purchase_service
from app.features.reports import service as reports_service
from app.features.sales import service as sale_service


class _DeviceIn:
    def __init__(self, imei):
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


class _PersonIn:
    def __init__(self, full_name="P"):
        self.full_name = full_name
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


async def _buy_then_sell(db, shop, user, *, imei, buy, sell, sale_date):
    _, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei=imei),
        seller_in=_PersonIn(),
        currency="UZS",
        price=Decimal(buy),
        exchange_rate=None,
        purchase_date=days_ago(2),
        comment=None,
    )
    await sale_service.create_sale(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_id=device.id,
        buyer_in=_PersonIn("Buyer"),
        sale_type="cash",
        currency="UZS",
        price=Decimal(sell),
        exchange_rate=None,
        sale_date=sale_date,
        comment=None,
    )


async def test_dashboard_splits_today_and_yesterday_profit(db):
    shop, user = await _make_shop(db, "A", 8101)

    # Yesterday: profit 300_000  (1_300_000 − 1_000_000)
    await _buy_then_sell(
        db, shop, user, imei="d1",
        buy="1000000", sell="1300000", sale_date=days_ago(1),
    )
    # Today: profit 200_000  (700_000 − 500_000)
    await _buy_then_sell(
        db, shop, user, imei="d2",
        buy="500000", sell="700000", sale_date=date.today(),
    )

    dash = await reports_service.today_dashboard(db, shop_id=shop.id)

    assert dash.profit_today == Decimal("200000.00")
    assert dash.profit_yesterday == Decimal("300000.00")


async def test_yesterday_profit_is_shop_isolated(db):
    shop_a, user_a = await _make_shop(db, "A", 8201)
    shop_b, user_b = await _make_shop(db, "B", 8202)

    await _buy_then_sell(
        db, shop_a, user_a, imei="a1",
        buy="1000000", sell="1300000", sale_date=days_ago(1),
    )
    # Shop B also sold yesterday — must not leak into A's delta.
    await _buy_then_sell(
        db, shop_b, user_b, imei="b1",
        buy="2000000", sell="2900000", sale_date=days_ago(1),
    )

    dash_a = await reports_service.today_dashboard(db, shop_id=shop_a.id)
    dash_b = await reports_service.today_dashboard(db, shop_id=shop_b.id)

    assert dash_a.profit_yesterday == Decimal("300000.00")
    assert dash_b.profit_yesterday == Decimal("900000.00")


async def test_no_yesterday_sales_gives_zero_not_none(db):
    shop, user = await _make_shop(db, "A", 8301)
    await _buy_then_sell(
        db, shop, user, imei="c1",
        buy="500000", sell="700000", sale_date=date.today(),
    )

    dash = await reports_service.today_dashboard(db, shop_id=shop.id)

    assert dash.profit_today == Decimal("200000.00")
    assert dash.profit_yesterday == Decimal("0.00")
