"""Report-builder breakdown: group active sales by a chosen dimension over a
period, with optional filters. Tested against real PostgreSQL (CLAUDE.md §13)
and asserts shop isolation (§6) + correct profit/revenue aggregation (§9)."""

from datetime import date, timedelta
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.purchases import service as purchase_service
from app.features.reports import service as reports_service
from app.features.sales import service as sale_service


class _DeviceIn:
    def __init__(self, imei, brand="Apple", model="iPhone 13", category="phone"):
        self.category = category
        self.brand = brand
        self.model = model
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


async def _buy_sell(db, shop, user, *, imei, buy, sell, day,
                    brand="Apple", model="iPhone 13", category="phone"):
    _, device = await purchase_service.create_purchase(
        db, shop_id=shop.id, user_id=user.id,
        device_in=_DeviceIn(imei=imei, brand=brand, model=model, category=category),
        seller_in=_PersonIn(),
        currency="UZS", price=Decimal(buy), exchange_rate=None,
        purchase_date=day - timedelta(days=3), comment=None,
    )
    await sale_service.create_sale(
        db, shop_id=shop.id, user_id=user.id, device_id=device.id,
        buyer_in=_PersonIn("Buyer"), sale_type="cash",
        currency="UZS", price=Decimal(sell), exchange_rate=None,
        sale_date=day, comment=None,
    )


async def test_breakdown_by_brand_aggregates_and_sorts(db):
    shop, user = await _make_shop(db, "A", 9601)
    day = date(2026, 5, 19)
    # Apple: two sales, profit 300k + 200k = 500k. Samsung: one, profit 100k.
    await _buy_sell(db, shop, user, imei="a1", buy="1000000", sell="1300000", day=day, brand="Apple")
    await _buy_sell(db, shop, user, imei="a2", buy="500000", sell="700000", day=day, brand="Apple")
    await _buy_sell(db, shop, user, imei="s1", buy="900000", sell="1000000", day=day, brand="Samsung")

    rep = await reports_service.breakdown(
        db, shop_id=shop.id, date_from=day, date_to=day, group_by="brand"
    )

    assert [r.label for r in rep.rows] == ["Apple", "Samsung"]  # sorted by profit desc
    apple = rep.rows[0]
    assert apple.units_sold == 2
    assert apple.revenue_uzs == Decimal("2000000.00")
    assert apple.profit_uzs == Decimal("500000.00")
    assert rep.total_units == 3
    assert rep.total_profit_uzs == Decimal("600000.00")


async def test_breakdown_by_category(db):
    shop, user = await _make_shop(db, "A", 9602)
    day = date(2026, 5, 19)
    await _buy_sell(db, shop, user, imei="p1", buy="1000000", sell="1300000", day=day, category="phone")
    await _buy_sell(db, shop, user, imei="l1", buy="2000000", sell="2500000", day=day,
                    category="laptop", brand="Dell", model="XPS")

    rep = await reports_service.breakdown(
        db, shop_id=shop.id, date_from=day, date_to=day, group_by="category"
    )
    by_key = {r.key: r for r in rep.rows}
    assert by_key["laptop"].profit_uzs == Decimal("500000.00")
    assert by_key["phone"].profit_uzs == Decimal("300000.00")


async def test_breakdown_brand_filter_narrows_rows(db):
    shop, user = await _make_shop(db, "A", 9603)
    day = date(2026, 5, 19)
    await _buy_sell(db, shop, user, imei="a1", buy="1000000", sell="1300000", day=day, brand="Apple")
    await _buy_sell(db, shop, user, imei="s1", buy="900000", sell="1000000", day=day, brand="Samsung")

    rep = await reports_service.breakdown(
        db, shop_id=shop.id, date_from=day, date_to=day,
        group_by="category", brand="Apple",
    )
    assert rep.total_units == 1
    assert rep.total_profit_uzs == Decimal("300000.00")  # Samsung excluded


async def test_breakdown_is_shop_isolated(db):
    shop_a, user_a = await _make_shop(db, "A", 9604)
    shop_b, user_b = await _make_shop(db, "B", 9605)
    day = date(2026, 5, 19)
    await _buy_sell(db, shop_a, user_a, imei="a1", buy="1000000", sell="1300000", day=day)
    await _buy_sell(db, shop_b, user_b, imei="b1", buy="1000000", sell="9000000", day=day)

    rep = await reports_service.breakdown(
        db, shop_id=shop_a.id, date_from=day, date_to=day, group_by="brand"
    )
    assert rep.total_profit_uzs == Decimal("300000.00")  # not B's 8M
