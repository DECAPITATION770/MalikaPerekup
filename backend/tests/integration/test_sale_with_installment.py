"""Atomic nasiya sale — POST /sales creates Sale + InstallmentPlan in one txn.

Exercises the real HTTP path (``client`` fixture) so we cover ``get_db``'s
commit-or-rollback contract, which is what makes the sale and its schedule
atomic. The regression we guard against: a nasiya sale that succeeds while its
schedule fails, leaving an orphan debt invisible to /installments and the KPIs.

Seeding note: the ``db`` fixture truncates with RESTART IDENTITY, so the first
user created here gets id == 1 — which matches ``DEV_BYPASS_USER_ID`` (conftest),
so the bypass-authenticated client acts as this shop's owner.
"""

from datetime import date
from decimal import Decimal

from app.features.admin import service as admin_service
from app.features.devices import repository as device_repo
from app.features.devices.models import DeviceStatus
from app.features.installments import repository as plan_repo
from app.features.purchases import service as purchase_service
from app.features.sales import repository as sale_repo


class _DeviceIn:
    def __init__(self, imei):
        self.category = "phone"
        self.brand = "Apple"
        self.model = "iPhone 14"
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


async def _seed_shop_with_device(db):
    """Commit one shop + owner (user id 1) + in-stock device for the client."""
    shop, user = await admin_service.register_shop_with_owner(
        db,
        name="A",
        language_default="ru",
        owner_full_name="Owner",
        owner_tg_id=7001,
        owner_tg_username=None,
        owner_phone=None,
        owner_login=None,
        owner_password=None,
    )
    # Bypass auth resolves user_id 1; the first inserted user must be the owner.
    assert user.id == 1, "bypass user (id 1) must be this shop's owner"
    _, device = await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=_DeviceIn(imei="900000000000001"),
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal("1000000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    # Capture plain ids before commit, then never touch the ORM objects again —
    # after the cross-session client request they'd be stale/detached.
    shop_id, device_id = shop.id, device.id
    # Commit so the app's own session (separate from `db`) sees the seed.
    await db.commit()
    return shop_id, device_id


def _payload(device_id: int, *, total: str) -> dict:
    today = date.today().isoformat()
    return {
        "device_id": device_id,
        "buyer": {"full_name": "Buyer", "phone": "+998901112233"},
        "sale_type": "nasiya",
        "currency": "UZS",
        "price": "1500000",
        "sale_date": today,
        "installment": {
            "total_amount": total,
            "down_payment": "500000",
            "period_type": "monthly",
            "period_count": 4,
            "start_date": today,
        },
    }


async def test_nasiya_sale_creates_plan_atomically(db, client):
    shop_id, device_id = await _seed_shop_with_device(db)

    resp = await client.post(
        "/api/v1/sales", json=_payload(device_id, total="1500000")
    )
    assert resp.status_code == 201, resp.text
    sale_id = resp.json()["id"]

    # The schedule was created in the same request — no follow-up call needed.
    plan = await plan_repo.get_plan_for_sale(db, sale_id, shop_id=shop_id)
    assert plan is not None
    assert plan.total_amount == Decimal("1500000")


async def test_bad_installment_rolls_back_whole_sale(db, client):
    """total_amount != price → 400, and NOTHING persists (no orphan debt)."""
    shop_id, device_id = await _seed_shop_with_device(db)

    resp = await client.post(
        "/api/v1/sales", json=_payload(device_id, total="999999")
    )
    assert resp.status_code == 400, resp.text

    # Re-read committed state via fresh repo SELECTs (plain int ids, no stale
    # ORM objects): no sale row, device still sellable.
    _, total = await sale_repo.search(
        db,
        shop_id=shop_id,
        date_from=None,
        date_to=None,
        sale_type=None,
        status=None,
        counterparty_id=None,
        limit=50,
        offset=0,
    )
    assert total == 0, "failed nasiya sale must leave no sale row"
    fresh = await device_repo.get_by_id(db, device_id, shop_id=shop_id)
    assert fresh is not None
    assert fresh.status == DeviceStatus.IN_STOCK.value
