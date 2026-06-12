import io
from types import SimpleNamespace

import pytest

from app.common import storage
from app.common.dates import now_utc
from app.features.auth import avatars
from app.features.auth.models import User


class _FakeBot:
    """Minimal aiogram-shaped stub for refresh_avatar."""

    def __init__(self, *, photo_bytes: bytes | None):
        self._photo_bytes = photo_bytes
        self.profile_calls = 0

    async def get_user_profile_photos(self, user_id, limit=1):
        self.profile_calls += 1
        if self._photo_bytes is None:
            return SimpleNamespace(total_count=0, photos=[])
        size = SimpleNamespace(file_id="FILE123")
        return SimpleNamespace(total_count=1, photos=[[size]])

    async def get_file(self, file_id):
        return SimpleNamespace(file_path="photos/file_123.jpg")

    async def download_file(self, file_path):
        return io.BytesIO(self._photo_bytes)


@pytest.mark.asyncio
async def test_refresh_avatar_stores_photo(db):
    storage.ensure_bucket()
    user = User(full_name="Ava", tg_id=800001)
    db.add(user)
    await db.commit()

    bot = _FakeBot(photo_bytes=b"\xff\xd8jpegbytes")
    await avatars.refresh_avatar(bot, db, user)

    assert user.avatar_key == f"avatars/{user.id}.jpg"
    assert user.avatar_fetched_at is not None
    data = storage._client().get_object(
        storage.get_settings().s3_bucket, user.avatar_key
    ).read()
    assert data == b"\xff\xd8jpegbytes"


@pytest.mark.asyncio
async def test_refresh_avatar_no_photo_sets_timestamp_only(db):
    user = User(full_name="NoPic", tg_id=800002)
    db.add(user)
    await db.commit()

    bot = _FakeBot(photo_bytes=None)
    await avatars.refresh_avatar(bot, db, user)

    assert user.avatar_key is None
    assert user.avatar_fetched_at is not None


@pytest.mark.asyncio
async def test_refresh_avatar_throttled(db):
    user = User(full_name="Fresh", tg_id=800003, avatar_fetched_at=now_utc())
    db.add(user)
    await db.commit()

    bot = _FakeBot(photo_bytes=b"x")
    await avatars.refresh_avatar(bot, db, user)
    assert bot.profile_calls == 0  # skipped — fetched <7d ago
