import hashlib
import hmac
import time
from urllib.parse import urlencode

import pytest

from app.core.security import create_access_token, decode_access_token, hash_password
from app.features.auth.models import User


def test_token_carries_src_claim():
    token = create_access_token(1, extra={"src": "telegram"})
    payload = decode_access_token(token)
    assert payload["src"] == "telegram"


@pytest.mark.asyncio
async def test_password_login_token_has_login_src(db):
    from app.features.auth import service

    user = User(full_name="Pass User", login="passuser",
                password_hash=hash_password("secret123"))
    db.add(user)
    await db.commit()

    _, token = await service.login_via_password(db, "passuser", "secret123")
    assert decode_access_token(token)["src"] == "login"
