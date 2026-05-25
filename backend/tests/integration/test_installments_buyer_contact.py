"""Backing query for GET /installments — debtor contact join.

The dashboard "who owes me and is overdue → call/Telegram" flow needs
each plan paired with the buyer's name, phone and Telegram handle. That
data lives on the linked sale (snapshot) and the counterparty directory
row (tg_username, nullable for walk-ins). The regression-worthy
behaviour is that join plus shop isolation — tested here directly
against real PostgreSQL (CLAUDE.md §6, §13).
"""

from datetime import date
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.installments import repository as repo
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


async def _nasiya_plan(db, shop, user, *, imei, buyer):
    """Buy a device, sell it on nasiya to ``buyer``, attach a schedule."""
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
        price=Decimal("1500000"),
        exchange_rate=None,
        sale_date=date.today(),
        comment=None,
    )
    plan, _ = await plan_service.create_plan(
        db,
        shop_id=shop.id,
        sale_id=sale.id,
        total_amount=Decimal("1500000"),
        down_payment=Decimal("300000"),
        period_type="monthly",
        period_count=6,
        start_date=date.today(),
    )
    return plan


async def test_search_plans_carries_buyer_contact(db):
    shop, user = await _make_shop(db, "A", 7101)

    plan = await _nasiya_plan(
        db, shop, user,
        imei="555000111",
        buyer=_PersonIn("Алишер Усманов", phone="+998901112233", tg_username="alisher_u"),
    )

    rows, total = await repo.search_plans(
        db, shop_id=shop.id, status=None, limit=50, offset=0
    )

    assert total == 1
    assert len(rows) == 1
    got_plan, buyer_name, buyer_phone, buyer_tg, _paid, _paid_n, _total_n, *_ = rows[0]
    assert got_plan.id == plan.id
    assert buyer_name == "Алишер Усманов"
    assert buyer_phone == "+998901112233"
    assert buyer_tg == "alisher_u"


async def test_walkin_buyer_has_no_tg_handle(db):
    """Counterparty exists but no Telegram → buyer_tg_username is None,
    name/phone still resolve so the user can at least call."""
    shop, user = await _make_shop(db, "A", 7102)

    await _nasiya_plan(
        db, shop, user,
        imei="555000222",
        buyer=_PersonIn("Прохожий", phone="+998900000000", tg_username=None),
    )

    rows, _ = await repo.search_plans(
        db, shop_id=shop.id, status=None, limit=50, offset=0
    )

    _, buyer_name, buyer_phone, buyer_tg, _paid, _paid_n, _total_n, *_ = rows[0]
    assert buyer_name == "Прохожий"
    assert buyer_phone == "+998900000000"
    assert buyer_tg is None


async def test_buyer_contact_is_shop_isolated(db):
    """Shop A must never see shop B's debtor in the joined list."""
    shop_a, user_a = await _make_shop(db, "A", 7201)
    shop_b, user_b = await _make_shop(db, "B", 7202)

    await _nasiya_plan(
        db, shop_a, user_a,
        imei="555000333",
        buyer=_PersonIn("Должник A", phone="+998901111111", tg_username="debtor_a"),
    )
    plan_b = await _nasiya_plan(
        db, shop_b, user_b,
        imei="555000444",
        buyer=_PersonIn("Должник B", phone="+998902222222", tg_username="debtor_b"),
    )

    rows_a, total_a = await repo.search_plans(
        db, shop_id=shop_a.id, status=None, limit=50, offset=0
    )
    assert total_a == 1
    names_a = {r[1] for r in rows_a}
    assert names_a == {"Должник A"}
    assert plan_b.id not in {r[0].id for r in rows_a}

    rows_b, total_b = await repo.search_plans(
        db, shop_id=shop_b.id, status=None, limit=50, offset=0
    )
    assert total_b == 1
    assert rows_b[0][1] == "Должник B"
    assert rows_b[0][3] == "debtor_b"
