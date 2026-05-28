"""Unit tests for JWT issue/verify (pure functions, no DB)."""

from datetime import UTC, datetime, timedelta

import pytest
from jose import jwt

from app.config import settings
from app.features.auth import jwt_service


def test_issue_and_verify_roundtrip() -> None:
    token, ttl = jwt_service.issue(user_id=123)
    assert ttl == settings.jwt_ttl_hours * 3600
    assert jwt_service.verify(token) == 123


def test_verify_rejects_expired_token() -> None:
    # Hand-craft an already-expired token.
    payload = {"sub": "1", "exp": datetime.now(UTC) - timedelta(seconds=1)}
    expired = jwt.encode(payload, settings.jwt_secret, algorithm=jwt_service.ALGORITHM)
    with pytest.raises(jwt_service.InvalidToken):
        jwt_service.verify(expired)


def test_verify_rejects_garbage() -> None:
    with pytest.raises(jwt_service.InvalidToken):
        jwt_service.verify("not.a.jwt")


def test_verify_rejects_wrong_signature() -> None:
    payload = {"sub": "1", "exp": datetime.now(UTC) + timedelta(hours=1)}
    bad = jwt.encode(payload, "different-secret", algorithm=jwt_service.ALGORITHM)
    with pytest.raises(jwt_service.InvalidToken):
        jwt_service.verify(bad)
