"""Backing queries for GET /devices/imei-check.

The endpoint is thin glue over two shop-scoped repo calls; the
regression-worthy behaviour is the shop isolation and the device→purchase
join, tested here directly against real PostgreSQL (CLAUDE.md §13).
"""

from datetime import date
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.devices import repository as device_repo
from app.features.purchases import repository as purchases_repo
from app.features.purchases import service as purchase_service


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


class _SellerIn:
    def __init__(self, full_name):
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


async def test_found_carries_purchase_date_and_seller(db):
    shop, user = await _make_shop(db, "A", 9001)
    await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei="356789012345678"),
        seller_in=_SellerIn("Иванов И."),
        currency="UZS",
        price=Decimal("1000000"),
        exchange_rate=None,
        purchase_date=date(2026, 4, 1),
        comment=None,
    )
    await db.flush()

    device = await device_repo.get_by_imei(
        db, "356789012345678", shop_id=shop.id
    )
    assert device is not None
    purchase = await purchases_repo.get_by_device(
        db, device.id, shop_id=shop.id
    )
    assert purchase is not None
    assert purchase.seller_name == "Иванов И."
    assert purchase.purchase_date == date(2026, 4, 1)


async def test_imei_is_shop_scoped(db):
    """Shop A must not see an IMEI registered in shop B (CLAUDE.md §6)."""
    shop_a, _ = await _make_shop(db, "A", 9002)
    shop_b, ub = await _make_shop(db, "B", 9003)

    await purchase_service.create_purchase(
        db,
        shop_id=shop_b.id,
        user_id=ub.id,
        device_in=_DeviceIn(imei="111111111111111"),
        seller_in=_SellerIn("Seller B"),
        currency="UZS",
        price=Decimal("500000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    await db.flush()

    assert (
        await device_repo.get_by_imei(
            db, "111111111111111", shop_id=shop_a.id
        )
        is None
    )
    assert (
        await device_repo.get_by_imei(
            db, "111111111111111", shop_id=shop_b.id
        )
        is not None
    )


async def test_unknown_imei_returns_none(db):
    shop, _ = await _make_shop(db, "A", 9004)
    assert (
        await device_repo.get_by_imei(
            db, "999999999999999", shop_id=shop.id
        )
        is None
    )
