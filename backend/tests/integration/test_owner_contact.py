import pytest

from app.features.auth.models import User


@pytest.mark.asyncio
async def test_update_contact(admin_client, db):
    u = User(full_name="Owner", tg_id=820001, phone="+998900000000")
    db.add(u)
    await db.commit()

    r = await admin_client.patch(
        f"/api/v1/admin/users/{u.id}/contact",
        json={"phone": "+998901112233", "admin_contact_note": "звонить вечером"},
    )
    assert r.status_code == 200
    assert r.json()["phone"] == "+998901112233"
    assert r.json()["admin_contact_note"] == "звонить вечером"

    cleared = await admin_client.patch(
        f"/api/v1/admin/users/{u.id}/contact",
        json={"phone": None, "admin_contact_note": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["phone"] is None
    assert cleared.json()["admin_contact_note"] is None

    missing = await admin_client.patch(
        "/api/v1/admin/users/999999/contact",
        json={"phone": None, "admin_contact_note": None},
    )
    assert missing.status_code == 404
