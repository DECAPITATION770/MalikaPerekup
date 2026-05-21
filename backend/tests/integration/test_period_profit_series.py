"""Backing query for the Reports profit sparkline (PeriodReport.profit_by_day).

Regression-worthy: every calendar day in range is present (gaps are real
zeros, not missing points), profit lands in the right day bucket, and it
stays shop-isolated — tested against real PostgreSQL (CLAUDE.md §6, §13).
"""

from datetime import date, timedelta
from decimal import Decimal

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
        db, name=name, language_default="ru",
        owner_full_name=f"Owner {name}", owner_tg_id=tg_id,
        owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    await db.flush()
    return shop, user


async def _buy_sell(db, shop, user, *, imei, buy, sell, sale_date):
    _, device = await purchase_service.create_purchase(
        db, shop_id=shop.id, user_id=user.id,
        device_in=_DeviceIn(imei=imei), seller_in=_PersonIn(),
        currency="UZS", price=Decimal(buy), exchange_rate=None,
        purchase_date=sale_date - timedelta(days=3), comment=None,
    )
    await sale_service.create_sale(
        db, shop_id=shop.id, user_id=user.id, device_id=device.id,
        buyer_in=_PersonIn("Buyer"), sale_type="cash",
        currency="UZS", price=Decimal(sell), exchange_rate=None,
        sale_date=sale_date, comment=None,
    )


async def test_profit_series_is_zero_filled_and_bucketed(db):
    shop, user = await _make_shop(db, "A", 8601)
    d_to = date(2026, 5, 19)
    d_from = d_to - timedelta(days=4)  # 5-day window

    # Sale on day 0 (profit 300k) and day 4 (profit 200k); days 1-3 silent.
    await _buy_sell(db, shop, user, imei="s1", buy="1000000", sell="1300000", sale_date=d_from)
    await _buy_sell(db, shop, user, imei="s2", buy="500000", sell="700000", sale_date=d_to)

    rep = await reports_service.period_report(
        db, shop_id=shop.id, date_from=d_from, date_to=d_to
    )

    series = rep.profit_by_day
    assert len(series) == 5  # every day present, inclusive
    assert series[0].day == d_from
    assert series[-1].day == d_to
    assert series[0].profit_uzs == Decimal("300000.00")
    assert series[1].profit_uzs == Decimal("0.00")  # real zero, not missing
    assert series[2].profit_uzs == Decimal("0.00")
    assert series[3].profit_uzs == Decimal("0.00")
    assert series[4].profit_uzs == Decimal("200000.00")


async def test_profit_series_is_shop_isolated(db):
    shop_a, user_a = await _make_shop(db, "A", 8701)
    shop_b, user_b = await _make_shop(db, "B", 8702)
    day = date(2026, 5, 19)

    await _buy_sell(db, shop_a, user_a, imei="a1", buy="1000000", sell="1300000", sale_date=day)
    await _buy_sell(db, shop_b, user_b, imei="b1", buy="1000000", sell="2000000", sale_date=day)

    rep_a = await reports_service.period_report(
        db, shop_id=shop_a.id, date_from=day, date_to=day
    )
    assert len(rep_a.profit_by_day) == 1
    assert rep_a.profit_by_day[0].profit_uzs == Decimal("300000.00")  # not B's 1M
