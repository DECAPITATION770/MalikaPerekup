"""End-to-end test of the core "buy → sell → return → resell" flow.

Runs against a real PostgreSQL instance; no mocks. Validates that every
feature module cooperates correctly inside one transaction.
"""

from datetime import date
from decimal import Decimal

import pytest

from app.common.dates import now_utc
from app.features.admin import service as admin_service
from app.features.devices.models import DeviceStatus
from app.features.installments import service as plan_service
from app.features.installments.models import PlanStatus
from app.features.purchases import service as purchase_service
from app.features.sales import service as sale_service
from app.features.sales.models import SaleStatus


class _DeviceIn:
    """Light stand-in for purchases.schemas.DeviceOnPurchase in service calls."""

    def __init__(self, **kw):
        self.category = kw.get("category", "phone")
        self.brand = kw.get("brand", "Samsung")
        self.model = kw.get("model", "Galaxy A55")
        self.imei = kw.get("imei")
        self.serial = kw.get("serial")
        self.condition = kw.get("condition", "good")
        self.specs = kw.get("specs", {})
        self.photos = kw.get("photos", [])
        self.defects = kw.get("defects", [])
        self.notes = kw.get("notes")


class _SellerIn:
    def __init__(self, full_name="Жасур", phone=None, **kw):
        self.full_name = full_name
        self.phone = phone
        self.doc_type = kw.get("doc_type")
        self.doc_number = kw.get("doc_number")
        self.photos = kw.get("photos", [])
        self.tg_username = kw.get("tg_username")


class _BuyerIn(_SellerIn):
    pass


@pytest.fixture
async def shop_with_owner(db):
    """Provision Shop + Owner via the admin service (closed-platform path)."""
    shop, user = await admin_service.register_shop_with_owner(
        db,
        name="Shop A",
        language_default="ru",
        owner_full_name="Owner One",
        owner_tg_id=1001,
        owner_tg_username=None,
        owner_phone=None,
        owner_login=None,
        owner_password=None,
    )
    await db.flush()
    return user, shop


async def test_buy_sell_cash_pins_profit(db, shop_with_owner):
    user, shop = shop_with_owner

    purchase, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei="123"),
        seller_in=_SellerIn(phone="+998901234567"),
        currency="UZS",
        price=Decimal("1200000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    assert device.status == DeviceStatus.IN_STOCK.value
    assert purchase.price_uzs == Decimal("1200000")

    sale, _ = await sale_service.create_sale(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_id=device.id,
        buyer_in=_BuyerIn(full_name="Алишер", phone="+998919876543"),
        sale_type="cash",
        currency="UZS",
        price=Decimal("1500000"),
        exchange_rate=None,
        sale_date=date.today(),
        comment=None,
    )
    # Profit pinned at sale time, device flipped.
    assert sale.profit_uzs == Decimal("300000")
    assert sale.purchase_price_uzs_snapshot == Decimal("1200000")
    assert device.status == DeviceStatus.SOLD.value
    assert sale.status == SaleStatus.ACTIVE.value


async def test_return_brings_device_back_to_stock(db, shop_with_owner):
    user, shop = shop_with_owner
    _, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei="222"),
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal("500000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    sale, _ = await sale_service.create_sale(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_id=device.id,
        buyer_in=_BuyerIn(full_name="Buyer"),
        sale_type="cash",
        currency="UZS",
        price=Decimal("700000"),
        exchange_rate=None,
        sale_date=date.today(),
        comment=None,
    )
    assert device.status == DeviceStatus.SOLD.value

    await sale_service.return_sale(db, sale, reason="битый экран")
    assert sale.status == SaleStatus.RETURNED.value
    assert device.status == DeviceStatus.IN_STOCK.value


async def test_nasiya_partial_then_early_payoff(db, shop_with_owner):
    user, shop = shop_with_owner
    _, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei="333"),
        seller_in=_SellerIn(),
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
        buyer_in=_BuyerIn(full_name="Buyer"),
        sale_type="nasiya",
        currency="UZS",
        price=Decimal("1500000"),
        exchange_rate=None,
        sale_date=date.today(),
        comment=None,
    )
    plan, payments = await plan_service.create_plan(
        db,
        shop_id=shop.id,
        sale_id=sale.id,
        total_amount=Decimal("1500000"),
        down_payment=Decimal("500000"),
        period_type="monthly",
        period_count=4,
        start_date=date.today(),
    )
    # 1 down + 4 monthly = 5 rows
    assert len(payments) == 5
    assert sum(p.amount_due for p in payments) == Decimal("1500000")

    # Partial payment: 200 000 against the down (500 000).
    await plan_service.record_payment(
        db, plan, amount=Decimal("200000"), paid_at=now_utc()
    )
    remaining_after_partial = sum(p.amount_due - p.amount_paid for p in payments)
    assert remaining_after_partial == Decimal("1300000")

    # Early payoff closes everything.
    await plan_service.early_payoff(db, plan, paid_at=now_utc())
    assert plan.status == PlanStatus.COMPLETED.value
    assert sum(p.amount_due - p.amount_paid for p in payments) == Decimal("0")


async def test_multi_tenant_isolation(db):
    """Shop A's user must not see Shop B's data via repository queries."""
    from app.features.devices import repository as device_repo

    shop_a, user_a = await admin_service.register_shop_with_owner(
        db, name="A", language_default="ru",
        owner_full_name="Owner A", owner_tg_id=2001,
        owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    shop_b, user_b = await admin_service.register_shop_with_owner(
        db, name="B", language_default="ru",
        owner_full_name="Owner B", owner_tg_id=2002,
        owner_tg_username=None, owner_phone=None,
        owner_login=None, owner_password=None,
    )
    await db.flush()

    _, device_a = await purchase_service.create_purchase(
        db,
        shop_id=shop_a.id,
        user_id=user_a.id,
        device_in=_DeviceIn(imei="A-1"),
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal("100000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )

    # Shop B asks for shop A's device by id → must get None.
    seen_from_b = await device_repo.get_by_id(db, device_a.id, shop_id=shop_b.id)
    assert seen_from_b is None

    # And by token — same answer (no cross-shop QR access).
    seen_by_token = await device_repo.get_by_token(db, device_a.qr_token)
    assert seen_by_token is not None  # bare lookup returns the row
    assert seen_by_token.shop_id == shop_a.id
    # The service-level helper is what enforces isolation:
    from app.features.devices import service as device_service
    from app.features.devices.service import DeviceNotFound

    with pytest.raises(DeviceNotFound):
        await device_service.get_by_token_or_404(
            db, device_a.qr_token, shop_id=shop_b.id
        )
