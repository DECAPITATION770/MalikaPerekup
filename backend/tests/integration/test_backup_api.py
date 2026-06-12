import pytest


@pytest.mark.asyncio
async def test_config_requires_admin(client):
    r = await client.get("/api/v1/admin/backup/config")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_get_and_put_config(admin_client):
    r = await admin_client.get("/api/v1/admin/backup/config")
    assert r.status_code == 200
    body = r.json()
    body["retention_count"] = 5
    body["frequency"] = "daily"
    body["daily_time"] = "03:00:00"
    r2 = await admin_client.put("/api/v1/admin/backup/config", json=body)
    assert r2.status_code == 200
    assert r2.json()["retention_count"] == 5
