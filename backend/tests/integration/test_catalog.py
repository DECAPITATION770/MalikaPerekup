"""Catalog (номенклатура) — CRUD, multi-tenancy isolation, upsert-on-purchase.

Multi-tenancy is the load-bearing invariant (CLAUDE.md §6): shop B must
never see or mutate shop A's templates. The upsert path is the other half
of the feature — buying a model fills its template so the next purchase
pre-fills (CLAUDE.md §15).

Uses the ``authed_client`` pattern from ``test_device_photo_urls`` — it
overrides ``get_db`` so HTTP queries hit the test engine (one event loop).
"""

from datetime import date
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.deps import get_current_user_id
from app.features.admin import service as admin_service
from app.features.catalog import repository as catalog_repo
from app.features.purchases import service as purchase_service

_IMEI = iter(str(n).zfill(15) for n in range(810_001, 820_000))


class _DeviceIn:
    def __init__(self, *, brand="Apple", model="iPhone 14 Pro", specs=None, photos=None):
        self.category = "phone"
        self.brand = brand
        self.model = model
        self.imei = next(_IMEI)
        self.serial = None
        self.condition = "good"
        self.specs = specs or {}
        self.photos = photos or []
        self.defects = []
        self.notes = None


class _SellerIn:
    full_name = "S"
    phone = None
    doc_type = None
    doc_number = None
    photos: list[str] = []
    tg_username = None


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


async def _buy(db, *, shop, user, device_in):
    await purchase_service.create_purchase(
        db,
        shop_id=shop.id,
        user_id=user.id,
        device_in=device_in,
        seller_in=_SellerIn(),
        currency="UZS",
        price=Decimal("9000000"),
        exchange_rate=None,
        purchase_date=date.today(),
        comment=None,
    )
    await db.flush()


_AUTHED_USER_ID: dict[str, int | None] = {"id": None}


def _as(user_id: int) -> None:
    _AUTHED_USER_ID["id"] = user_id


@pytest.fixture
async def authed_client(engine):
    from sqlalchemy.ext.asyncio import async_sessionmaker

    from app.core.database import get_db
    from app.main import app

    async def _override_user_id(authorization: str | None = None) -> int:  # noqa: ARG001
        from fastapi import HTTPException, status

        uid = _AUTHED_USER_ID["id"]
        if uid is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "no test user set")
        return uid

    test_factory = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

    async def _override_db():
        async with test_factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_current_user_id] = _override_user_id
    app.dependency_overrides[get_db] = _override_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_current_user_id, None)
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def shops(db):
    shop_a, user_a = await _make_shop(db, "A", 8101)
    shop_b, user_b = await _make_shop(db, "B", 8102)
    await db.commit()
    return {"a": (shop_a, user_a), "b": (shop_b, user_b)}


# ── CRUD ────────────────────────────────────────────────────────────────


async def test_create_then_list_and_get(authed_client, shops):
    _as(shops["a"][1].id)
    payload = {
        "category": "phone",
        "brand": "Apple",
        "model": "iPhone 15 Pro",
        "default_specs": {"ram_gb": 8, "storage_gb": 256, "color": "Чёрный"},
        "photos": [],
    }
    resp = await authed_client.post("/api/v1/catalog", json=payload)
    assert resp.status_code == 201, resp.text
    created = resp.json()
    assert created["brand"] == "Apple"
    assert created["default_specs"]["ram_gb"] == 8

    listed = await authed_client.get("/api/v1/catalog")
    assert listed.status_code == 200
    assert listed.json()["total"] == 1

    got = await authed_client.get(f"/api/v1/catalog/{created['id']}")
    assert got.status_code == 200
    assert got.json()["model"] == "iPhone 15 Pro"


async def test_update_and_delete(authed_client, shops):
    _as(shops["a"][1].id)
    created = (
        await authed_client.post(
            "/api/v1/catalog",
            json={"category": "phone", "brand": "Samsung", "model": "Galaxy S24"},
        )
    ).json()

    patch = await authed_client.patch(
        f"/api/v1/catalog/{created['id']}",
        json={"default_specs": {"ram_gb": 12}},
    )
    assert patch.status_code == 200, patch.text
    assert patch.json()["default_specs"]["ram_gb"] == 12

    deleted = await authed_client.delete(f"/api/v1/catalog/{created['id']}")
    assert deleted.status_code == 204
    assert (await authed_client.get("/api/v1/catalog")).json()["total"] == 0


async def test_duplicate_model_returns_409(authed_client, shops):
    _as(shops["a"][1].id)
    body = {"category": "phone", "brand": "Apple", "model": "iPhone 13"}
    assert (await authed_client.post("/api/v1/catalog", json=body)).status_code == 201
    dup = await authed_client.post("/api/v1/catalog", json=body)
    assert dup.status_code == 409, dup.text


async def test_invalid_specs_rejected(authed_client, shops):
    _as(shops["a"][1].id)
    resp = await authed_client.post(
        "/api/v1/catalog",
        json={
            "category": "phone",
            "brand": "Apple",
            "model": "iPhone 12",
            "default_specs": {"cpu": "nonsense-key-for-phone"},
        },
    )
    assert resp.status_code == 400, resp.text


# ── Multi-tenancy (CLAUDE.md §6) ─────────────────────────────────────────


async def test_shop_b_cannot_see_or_touch_shop_a_catalog(authed_client, shops):
    _as(shops["a"][1].id)
    a_item = (
        await authed_client.post(
            "/api/v1/catalog",
            json={"category": "phone", "brand": "Apple", "model": "iPhone 14"},
        )
    ).json()

    # Switch to shop B.
    _as(shops["b"][1].id)
    assert (await authed_client.get("/api/v1/catalog")).json()["total"] == 0
    assert (await authed_client.get(f"/api/v1/catalog/{a_item['id']}")).status_code == 404
    assert (
        await authed_client.patch(
            f"/api/v1/catalog/{a_item['id']}", json={"brand": "Hacked"}
        )
    ).status_code == 404
    assert (
        await authed_client.delete(f"/api/v1/catalog/{a_item['id']}")
    ).status_code == 404


# ── Upsert on purchase (CLAUDE.md §15) ───────────────────────────────────


async def test_purchase_creates_catalog_template(db, shops):
    shop_a, user_a = shops["a"]
    await _buy(
        db,
        shop=shop_a,
        user=user_a,
        device_in=_DeviceIn(
            specs={"ram_gb": 6, "storage_gb": 256}, photos=["shops/x/catalog/p.jpg"]
        ),
    )
    items, total = await catalog_repo.search(
        db, shop_id=shop_a.id, query=None, category=None, limit=50, offset=0
    )
    assert total == 1
    tmpl = items[0]
    assert (tmpl.brand, tmpl.model) == ("Apple", "iPhone 14 Pro")
    assert tmpl.default_specs["ram_gb"] == 6
    assert tmpl.photos == ["shops/x/catalog/p.jpg"]


async def test_second_purchase_refreshes_without_duplicating(db, shops):
    shop_a, user_a = shops["a"]
    await _buy(db, shop=shop_a, user=user_a, device_in=_DeviceIn(specs={"ram_gb": 6}))
    # Same model again, this time adding a colour — should fill, not duplicate.
    await _buy(
        db,
        shop=shop_a,
        user=user_a,
        device_in=_DeviceIn(specs={"ram_gb": 6, "color": "Белый"}),
    )
    items, total = await catalog_repo.search(
        db, shop_id=shop_a.id, query=None, category=None, limit=50, offset=0
    )
    assert total == 1
    assert items[0].default_specs.get("color") == "Белый"
    # Two purchases of the same model → frequency counter reaches 2.
    assert items[0].purchase_count == 2


async def test_purchase_upsert_is_shop_scoped(db, shops):
    shop_a, user_a = shops["a"]
    shop_b, user_b = shops["b"]
    await _buy(db, shop=shop_a, user=user_a, device_in=_DeviceIn(model="iPhone 14 Pro"))
    await _buy(db, shop=shop_b, user=user_b, device_in=_DeviceIn(model="iPhone 14 Pro"))
    _, total_b = await catalog_repo.search(
        db, shop_id=shop_b.id, query=None, category=None, limit=50, offset=0
    )
    # Each shop gets its own template — no shared row.
    assert total_b == 1
