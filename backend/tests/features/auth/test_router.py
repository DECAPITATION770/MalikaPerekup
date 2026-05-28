"""Integration tests for /api/auth/* routes. Requires Postgres running."""

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text

from app.db import engine
from app.main import app


@pytest_asyncio.fixture(autouse=True, loop_scope="session")
async def clean_users() -> None:
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))
    yield


@pytest_asyncio.fixture(loop_scope="session")
async def aclient() -> AsyncClient:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(loop_scope="session")
async def auth_token(aclient: AsyncClient) -> str:
    """Acquire a real JWT via dev-bypass for downstream tests."""
    response = await aclient.post("/api/auth/telegram", json={"init_data": ""})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


@pytest.mark.asyncio(loop_scope="session")
async def test_telegram_login_dev_bypass_returns_jwt(aclient: AsyncClient) -> None:
    response = await aclient.post("/api/auth/telegram", json={"init_data": ""})
    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] > 0
    assert len(body["access_token"]) > 20


@pytest.mark.asyncio(loop_scope="session")
async def test_me_returns_authed_user(aclient: AsyncClient, auth_token: str) -> None:
    response = await aclient.get(
        "/api/auth/me", headers={"Authorization": f"Bearer {auth_token}"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body["tg_id"] == 1
    assert body["tg_username"] == "devuser"
    assert body["language"] == "ru"


@pytest.mark.asyncio(loop_scope="session")
async def test_me_rejects_missing_bearer(aclient: AsyncClient) -> None:
    response = await aclient.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio(loop_scope="session")
async def test_me_rejects_garbage_token(aclient: AsyncClient) -> None:
    response = await aclient.get(
        "/api/auth/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert response.status_code == 401
