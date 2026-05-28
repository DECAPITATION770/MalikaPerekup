"""Integration tests for /api/admin/tenants. Requires Postgres + super-admin login."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.db import engine
from app.features.auth import jwt_service
from app.main import app


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def clean_db() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE users, tenants RESTART IDENTITY CASCADE"))
    yield


@pytest_asyncio.fixture(loop_scope="session")
async def aclient() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(loop_scope="session")
async def admin_headers(aclient: AsyncClient) -> dict[str, str]:
    response = await aclient.post("/api/auth/telegram", json={"init_data": ""})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.mark.asyncio(loop_scope="session")
async def test_create_tenant_with_owner_tg_id(
    aclient: AsyncClient, admin_headers: dict[str, str]
) -> None:
    response = await aclient.post(
        "/api/admin/tenants",
        json={"name": "Galaxy Mobile", "owner_tg_id": 12345},
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["name"] == "Galaxy Mobile"
    assert body["is_active"] is True
    assert body["owner"]["tg_id"] == 12345
    assert body["owner"]["tg_username"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_create_tenant_with_owner_username(
    aclient: AsyncClient, admin_headers: dict[str, str]
) -> None:
    response = await aclient.post(
        "/api/admin/tenants",
        json={"name": "iShop", "owner_tg_username": "@johndoe"},
        headers=admin_headers,
    )
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["owner"]["tg_username"] == "johndoe"  # @-stripped, lowercase preserved
    assert body["owner"]["tg_id"] is None


@pytest.mark.asyncio(loop_scope="session")
async def test_create_tenant_requires_exactly_one_owner_id(
    aclient: AsyncClient, admin_headers: dict[str, str]
) -> None:
    # Both provided.
    r1 = await aclient.post(
        "/api/admin/tenants",
        json={"name": "X", "owner_tg_id": 1, "owner_tg_username": "a"},
        headers=admin_headers,
    )
    assert r1.status_code == 422

    # Neither provided.
    r2 = await aclient.post(
        "/api/admin/tenants", json={"name": "X"}, headers=admin_headers
    )
    assert r2.status_code == 422


@pytest.mark.asyncio(loop_scope="session")
async def test_create_tenant_rejects_duplicate_tg_id(
    aclient: AsyncClient, admin_headers: dict[str, str]
) -> None:
    await aclient.post(
        "/api/admin/tenants",
        json={"name": "A", "owner_tg_id": 999},
        headers=admin_headers,
    )
    response = await aclient.post(
        "/api/admin/tenants",
        json={"name": "B", "owner_tg_id": 999},
        headers=admin_headers,
    )
    assert response.status_code == 409


@pytest.mark.asyncio(loop_scope="session")
async def test_list_tenants(aclient: AsyncClient, admin_headers: dict[str, str]) -> None:
    await aclient.post(
        "/api/admin/tenants",
        json={"name": "Shop A", "owner_tg_id": 100},
        headers=admin_headers,
    )
    await aclient.post(
        "/api/admin/tenants",
        json={"name": "Shop B", "owner_tg_username": "shopb_owner"},
        headers=admin_headers,
    )
    response = await aclient.get("/api/admin/tenants", headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 2
    names = {t["name"] for t in body}
    assert names == {"Shop A", "Shop B"}


@pytest.mark.asyncio(loop_scope="session")
async def test_admin_routes_reject_non_super_admin(aclient: AsyncClient) -> None:
    # Hand-craft an owner JWT (no DB user backing it — dependencies don't query DB).
    owner_token, _ = jwt_service.issue(user_id=99, tenant_id=1, role="owner")
    response = await aclient.get(
        "/api/admin/tenants", headers={"Authorization": f"Bearer {owner_token}"}
    )
    assert response.status_code == 403


@pytest.mark.asyncio(loop_scope="session")
async def test_admin_routes_require_auth(aclient: AsyncClient) -> None:
    response = await aclient.get("/api/admin/tenants")
    assert response.status_code == 401
