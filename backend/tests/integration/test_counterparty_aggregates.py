"""Per-row aggregates joined into the counterparty directory list.

The list endpoint needs to show "owes ₽X across N deals" at a glance —
that means computing outstanding nasiya debt, the deal count and the
most-recent deal date in **one** query, scoped to ``shop_id`` so a
counterparty in shop A never inherits shop B's activity (CLAUDE.md §6).
"""

from datetime import date
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.counterparties import repository as repo
from app.features.installments import service as plan_service
from app.features.purchases import service as purchase_service
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
    def __init__(self, full_name, phone=None, tg_username=None):
        self.full_name = full_name
        self.phone = phone
        self.doc_type = None
        self.doc_number = None
        self.photos = []
        self.tg_username = tg_username


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


async def _nasiya_sale(db, shop, user, *, imei, buyer, total: Decimal):
    """Buy a phone, sell on nasiya (no down payment so the test stays
    independent of the down-payment-counts-as-paid wiring)."""
    _, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei=imei),
        seller_in=_PersonIn("Seller"),
        currency="UZS",
        price=Decimal("1000000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    sale, _ = await sale_service.create_sale(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_id=device.id,
        buyer_in=buyer,
        sale_type="nasiya",
        currency="UZS",
        price=total,
        exchange_rate=None,
        sale_date=date.today(),
        comment=None,
    )
    plan, _ = await plan_service.create_plan(
        db,
        shop_id=shop.id,
        sale_id=sale.id,
        total_amount=total,
        down_payment=Decimal("0"),
        period_type="monthly",
        period_count=6,
        start_date=date.today(),
    )
    return sale, plan


async def test_list_shows_outstanding_nasiya_and_deal_count(db):
    """One nasiya sale → list row has deals_count=1, outstanding=total, last_at set."""
    shop, user = await _make_shop(db, "A", 9101)
    buyer = _PersonIn("Алишер Усманов", phone="+998901112233")
    await _nasiya_sale(
        db, shop, user, imei="900000001", buyer=buyer, total=Decimal("1500000")
    )

    items, total = await repo.search_with_aggregates(
        db, shop_id=shop.id, query=None, type_=None, limit=50, offset=0
    )

    # The buyer counterparty was created automatically by sale_service from
    # buyer_in.phone; the seller counterparty was created earlier too.
    by_name = {cp.full_name: (cp, deals, owed, last_at) for cp, deals, owed, last_at in items}
    assert "Алишер Усманов" in by_name, by_name.keys()
    cp, deals, owed, last_at = by_name["Алишер Усманов"]
    assert deals == 1
    assert owed == Decimal("1500000")
    assert last_at is not None
    assert total >= 1


async def test_list_aggregates_are_shop_isolated(db):
    """Shop A's debt never bleeds into shop B's list, and vice versa."""
    shop_a, user_a = await _make_shop(db, "A", 9201)
    shop_b, user_b = await _make_shop(db, "B", 9202)

    await _nasiya_sale(
        db, shop_a, user_a,
        imei="900000010",
        buyer=_PersonIn("Должник A", phone="+998901111111"),
        total=Decimal("700000"),
    )
    await _nasiya_sale(
        db, shop_b, user_b,
        imei="900000020",
        buyer=_PersonIn("Должник B", phone="+998902222222"),
        total=Decimal("900000"),
    )

    items_a, _ = await repo.search_with_aggregates(
        db, shop_id=shop_a.id, query=None, type_=None, limit=50, offset=0
    )
    items_b, _ = await repo.search_with_aggregates(
        db, shop_id=shop_b.id, query=None, type_=None, limit=50, offset=0
    )

    names_a = {cp.full_name: owed for cp, _deals, owed, _last in items_a}
    names_b = {cp.full_name: owed for cp, _deals, owed, _last in items_b}

    # Each shop sees only its own debtor name AND its own debt amount.
    assert "Должник A" in names_a and "Должник B" not in names_a
    assert "Должник B" in names_b and "Должник A" not in names_b
    assert names_a["Должник A"] == Decimal("700000")
    assert names_b["Должник B"] == Decimal("900000")


async def test_cash_sale_contributes_no_debt(db):
    """A counterparty with only a cash sale: deals_count=1 but owed=0."""
    shop, user = await _make_shop(db, "A", 9301)
    _, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei="900000030"),
        seller_in=_PersonIn("Seller"),
        currency="UZS",
        price=Decimal("500000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    await sale_service.create_sale(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_id=device.id,
        buyer_in=_PersonIn("Кэш-покупатель", phone="+998903333333"),
        sale_type="cash",
        currency="UZS",
        price=Decimal("800000"),
        exchange_rate=None,
        sale_date=date.today(),
        comment=None,
    )

    items, _ = await repo.search_with_aggregates(
        db, shop_id=shop.id, query=None, type_=None, limit=50, offset=0
    )
    by_name = {cp.full_name: (deals, owed) for cp, deals, owed, _last in items}
    assert by_name["Кэш-покупатель"] == (1, Decimal("0"))
