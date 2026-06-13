"""Regression: outstanding nasiya debt must NOT fan out over payment rows.

The dashboard/admin debt KPI used to compute ``SUM(total_amount) -
SUM(amount_paid)`` over a plan→payments join, which multiplied total_amount by
the number of schedule rows (a 6 000 000 plan with 4 rows + 1 000 000 down
showed 23 000 000 instead of 5 000 000). ``outstanding_debt`` is now the single
source of truth; this test pins the correct value.
"""

from datetime import date
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.installments import repository as installment_repo
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


class _Party:
    def __init__(self, full_name):
        self.full_name = full_name
        self.phone = None
        self.doc_type = None
        self.doc_number = None
        self.photos = []
        self.tg_username = None


async def _nasiya_plan(db, shop, user, *, imei, total, down, rows):
    _, device = await purchase_service.create_purchase(
        db, shop_id=shop.id, user_id=user.id,
        device_in=_DeviceIn(imei=imei), seller_in=_Party("Seller"),
        currency="UZS", price=Decimal("4000000"), exchange_rate=None,
        purchase_date=date.today(), comment=None,
    )
    sale, _ = await sale_service.create_sale(
        db, shop_id=shop.id, user_id=user.id, device_id=device.id,
        buyer_in=_Party("Buyer"), sale_type="nasiya", currency="UZS",
        price=total, exchange_rate=None, sale_date=date.today(), comment=None,
    )
    await plan_service.create_plan(
        db, shop_id=shop.id, sale_id=sale.id, total_amount=total,
        down_payment=down, period_type="monthly", period_count=rows,
        start_date=date.today(),
    )


async def test_debt_does_not_fan_out_over_payment_rows(db):
    shop, user = await admin_service.register_shop_with_owner(
        db, name="A", language_default="ru", owner_full_name="Owner",
        owner_tg_id=8101, owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    await db.flush()

    # 6 000 000 total, 1 000 000 down already paid, 3 monthly rows.
    await _nasiya_plan(
        db, shop, user, imei="900111", total=Decimal("6000000"),
        down=Decimal("1000000"), rows=3,
    )

    debt = await installment_repo.outstanding_debt(db, shop_id=shop.id)
    # Correct remaining = 6 000 000 - 1 000 000 = 5 000 000.
    assert debt == Decimal("5000000")
    # The old fan-out bug produced 23 000 000 (total ×4 rows − down).
    assert debt != Decimal("23000000")


async def test_debt_is_shop_scoped_and_platform_wide(db):
    shop_a, ua = await admin_service.register_shop_with_owner(
        db, name="A", language_default="ru", owner_full_name="A",
        owner_tg_id=8201, owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    shop_b, ub = await admin_service.register_shop_with_owner(
        db, name="B", language_default="ru", owner_full_name="B",
        owner_tg_id=8202, owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    await db.flush()

    await _nasiya_plan(db, shop_a, ua, imei="A900", total=Decimal("6000000"),
                       down=Decimal("1000000"), rows=3)   # remaining 5M
    await _nasiya_plan(db, shop_b, ub, imei="B900", total=Decimal("3000000"),
                       down=Decimal("0"), rows=2)          # remaining 3M

    assert await installment_repo.outstanding_debt(db, shop_id=shop_a.id) == Decimal("5000000")
    assert await installment_repo.outstanding_debt(db, shop_id=shop_b.id) == Decimal("3000000")
    # Platform-wide sums both shops.
    assert await installment_repo.outstanding_debt(db) == Decimal("8000000")
