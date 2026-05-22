"""Seed a demo shop (+ sample devices with photos) after a fresh DB reset.

Creates the platform admin (from BOOTSTRAP_* env, no-op if one exists), a
demo shop whose owner signs in with login/password, and a handful of devices
across brands/categories/conditions/prices so the Stock list, filters and
device card have something to show. Placeholder photos are generated with
Pillow and uploaded to MinIO.

Usage:
    cd backend
    uv run python scripts/seed_demo.py

Idempotent: skips the shop if the owner login exists, and skips devices if
the shop already has any.
"""

import asyncio
import sys
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from io import BytesIO

sys.path.insert(0, ".")

from PIL import Image, ImageDraw  # noqa: E402
from sqlalchemy import select, update  # noqa: E402

from app.common.storage import build_upload_key, ensure_bucket, upload  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.core.database import SessionFactory  # noqa: E402
from app.features.admin import service as admin_service  # noqa: E402
from app.features.auth import repository as user_repo  # noqa: E402
from app.features.devices import repository as device_repo  # noqa: E402
from app.features.devices.models import Device  # noqa: E402
from app.features.purchases import service as purchase_service  # noqa: E402
from app.features.shops.models import Shop  # noqa: E402

DEMO_SHOP_NAME = "Malika Demo"
DEMO_OWNER_NAME = "Malika Owner"
DEMO_LOGIN = "malika"
DEMO_PASSWORD = "malika12345"

# brand, model, category, condition, specs, defects, price, photo?, rgb, days_ago, seller
DEMO_DEVICES = [
    ("Apple", "iPhone 14 Pro", "phone", "new",
     {"ram_gb": 6, "storage_gb": 256, "color": "Чёрный", "battery_health_pct": 96},
     [], "9500000", True, (28, 28, 34), 1, "Шерзод"),
    ("Samsung", "Galaxy S23", "phone", "good",
     {"ram_gb": 8, "storage_gb": 128, "color": "Зелёный", "battery_health_pct": 88},
     [], "6200000", True, (40, 90, 70), 4, "Дилшод"),
    ("Apple", "MacBook Air M2", "laptop", "good",
     {"ram_gb": 16, "storage_gb": 512, "cpu": "M2", "screen_inches": 13.6, "color": "Серый"},
     [], "12000000", True, (70, 70, 80), 9, "Азиз"),
    ("Xiaomi", "Redmi Note 12", "phone", "normal",
     {"ram_gb": 6, "storage_gb": 128, "color": "Синий", "battery_health_pct": 79},
     ["scratches_body"], "2300000", False, (50, 70, 120), 21, "Бек"),
    ("Apple", "Watch SE", "smartwatch", "good",
     {"storage_gb": 32, "color": "Чёрный", "battery_health_pct": 90, "connectivity": ["gps"]},
     [], "1800000", False, (30, 30, 36), 6, "Нодир"),
    ("Apple", "iPad Air", "tablet", "good",
     {"ram_gb": 8, "storage_gb": 256, "color": "Белый", "battery_health_pct": 93},
     [], "5400000", True, (200, 200, 210), 13, "Камола"),
]


class _DeviceIn:
    def __init__(self, *, brand, model, category, condition, specs, defects, photos):
        self.category = category
        self.brand = brand
        self.model = model
        self.imei = None
        self.serial = None
        self.condition = condition
        self.specs = specs
        self.photos = photos
        self.defects = defects
        self.notes = None


class _SellerIn:
    def __init__(self, name):
        self.full_name = name
        self.phone = None
        self.doc_type = None
        self.doc_number = None
        self.photos = []
        self.tg_username = None


def _placeholder_png(label: str, rgb: tuple[int, int, int]) -> bytes:
    """A 400×400 solid tile with the device label — enough to verify display."""
    img = Image.new("RGB", (400, 400), rgb)
    draw = ImageDraw.Draw(img)
    draw.text((24, 184), label, fill=(255, 255, 255))
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _seed_devices(db, shop) -> int:
    """Add the demo devices, skipping any whose (fixed) IMEI already exists —
    so re-running is safe and it co-exists with whatever's already there."""
    ensure_bucket()
    owner = await user_repo.get_by_login(db, DEMO_LOGIN)
    imei_seq = 990000000000000
    seeded = 0
    for brand, model, cat, cond, specs, defects, price, has_photo, rgb, days_ago, seller in DEMO_DEVICES:
        imei = str(imei_seq)
        imei_seq += 1
        if await device_repo.get_by_imei(db, imei, shop_id=shop.id) is not None:
            continue  # already seeded on a previous run

        photos: list[str] = []
        if has_photo:
            key = build_upload_key(shop.id, "devices", f"{brand}-{model}.png")
            upload(key, _placeholder_png(f"{brand} {model}", rgb), "image/png")
            photos.append(key)

        di = _DeviceIn(
            brand=brand, model=model, category=cat, condition=cond,
            specs=specs, defects=defects, photos=photos,
        )
        di.imei = imei

        _, device = await purchase_service.create_purchase(
            db,
            shop_id=shop.id,
            user_id=owner.id,
            device_in=di,
            seller_in=_SellerIn(seller),
            currency="UZS",
            price=Decimal(price),
            exchange_rate=None,
            purchase_date=date.today() - timedelta(days=days_ago),
            comment=None,
        )
        # Backdate created_at so "days in stock" / sort-by-age vary in the demo.
        await db.execute(
            update(Device)
            .where(Device.id == device.id)
            .values(created_at=datetime.now(timezone.utc) - timedelta(days=days_ago))
        )
        seeded += 1
    print(f"Seeded {seeded} demo devices ({sum(1 for d in DEMO_DEVICES if d[7])} with photos).")
    return seeded


async def main() -> None:
    settings = get_settings()
    async with SessionFactory() as db:
        # 1. Platform admin (login/password) from env — no-op if any exists.
        await admin_service.bootstrap_admins_if_needed(
            db,
            tg_ids=settings.bootstrap_admin_ids,
            login=settings.bootstrap_admin_login,
            password=settings.bootstrap_admin_password,
            name=settings.bootstrap_admin_name,
        )

        # 2. Demo shop + owner (tenant login).
        owner = await user_repo.get_by_login(db, DEMO_LOGIN)
        if owner is None:
            shop, owner = await admin_service.register_shop_with_owner(
                db,
                name=DEMO_SHOP_NAME,
                language_default="ru",
                owner_full_name=DEMO_OWNER_NAME,
                owner_tg_id=None,
                owner_tg_username=None,
                owner_phone=None,
                owner_login=DEMO_LOGIN,
                owner_password=DEMO_PASSWORD,
            )
            print(f"Created shop '{shop.name}' (id={shop.id}), owner '{DEMO_LOGIN}' (user id={owner.id}).")
        else:
            shop = await db.get(Shop, owner.shop_id)
            print(f"Demo owner '{DEMO_LOGIN}' exists (user id={owner.id}); using shop id={shop.id}.")

        # 3. Sample devices with photos.
        await _seed_devices(db, shop)

        await db.commit()

    async with SessionFactory() as db:
        total = (await db.execute(select(Shop))).scalars().all()
        print(f"Shops in DB: {len(total)}")
    print("\nTenant login:  malika / malika12345")
    print(f"Admin login:   {settings.bootstrap_admin_login} / {settings.bootstrap_admin_password}")


if __name__ == "__main__":
    asyncio.run(main())
