"""Tests for creating/updating platform admins from the panel."""

import pytest

from app.core.security import verify_password
from app.features.admin import repository as admin_repo
from app.features.admin import service as admin_service
from app.features.admin.models import PlatformAdmin


@pytest.fixture
async def boss(db) -> PlatformAdmin:
    a = PlatformAdmin(tg_id=99001, login="boss", password_hash="x", full_name="Boss")
    db.add(a)
    await db.flush()
    return a


async def test_create_admin_with_login(db, boss):
    created = await admin_service.create_admin(
        db, full_name="Second", login="second", password="supersecret"
    )
    assert created.id != boss.id
    assert created.login == "second"
    assert created.is_active is True
    assert verify_password("supersecret", created.password_hash)


async def test_create_admin_with_tg(db, boss):
    created = await admin_service.create_admin(
        db, full_name="TgOnly", tg_id=12345, tg_username="tgonly"
    )
    assert created.tg_id == 12345
    assert created.password_hash is None


async def test_create_admin_requires_auth_method(db, boss):
    with pytest.raises(admin_service.AdminValidationError):
        await admin_service.create_admin(db, full_name="Nobody")


async def test_create_admin_login_requires_password(db, boss):
    with pytest.raises(admin_service.AdminValidationError):
        await admin_service.create_admin(db, full_name="X", login="nopass")


async def test_create_admin_rejects_duplicate_login(db, boss):
    with pytest.raises(admin_service.AdminConflictError):
        await admin_service.create_admin(
            db, full_name="Dup", login="boss", password="anotherpass"
        )


async def test_create_admin_rejects_duplicate_tg(db, boss):
    with pytest.raises(admin_service.AdminConflictError):
        await admin_service.create_admin(db, full_name="Dup", tg_id=99001)


async def test_update_admin_deactivate(db, boss):
    other = await admin_service.create_admin(
        db, full_name="Other", login="other", password="supersecret"
    )
    updated = await admin_service.update_admin(
        db, other, acting_admin_id=boss.id, is_active=False
    )
    assert updated.is_active is False


async def test_update_admin_cannot_deactivate_self(db, boss):
    with pytest.raises(admin_service.AdminLockoutError):
        await admin_service.update_admin(
            db, boss, acting_admin_id=boss.id, is_active=False
        )


async def test_update_admin_cannot_deactivate_last_active(db):
    """Only one admin exists — deactivating anyone (even by another acting id)
    must be refused so the panel never locks out completely."""
    only = PlatformAdmin(login="solo", password_hash="x", full_name="Solo")
    db.add(only)
    await db.flush()
    with pytest.raises(admin_service.AdminLockoutError):
        await admin_service.update_admin(
            db, only, acting_admin_id=999, is_active=False
        )


async def test_update_admin_password_requires_login(db, boss):
    tg_only = await admin_service.create_admin(
        db, full_name="TgOnly", tg_id=55555
    )
    with pytest.raises(admin_service.AdminValidationError):
        await admin_service.update_admin(
            db, tg_only, acting_admin_id=boss.id, password="brandnewpass"
        )


async def test_list_admins_returns_all(db, boss):
    await admin_service.create_admin(
        db, full_name="Two", login="two", password="supersecret"
    )
    admins = await admin_repo.list_admins(db)
    assert len(admins) == 2
