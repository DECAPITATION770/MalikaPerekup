"""Unit tests for JWT issue/verify (pure functions, no DB)."""

from datetime import UTC, datetime, timedelta

import pytest
from jose import jwt

from app.config import settings
from app.features.auth import jwt_service


def test_issue_and_verify_roundtrip() -> None:
    token, ttl = jwt_service.issue(user_id=123, tenant_id=7, role="owner")
    assert ttl == settings.jwt_ttl_hours * 3600
    payload = jwt_service.verify(token)
    assert payload.user_id == 123
    assert payload.tenant_id == 7
    assert payload.role == "owner"


def test_issue_super_admin_has_no_tenant() -> None:
    token, _ = jwt_service.issue(user_id=1, tenant_id=None, role="super_admin")
    payload = jwt_service.verify(token)
    assert payload.tenant_id is None
    assert payload.role == "super_admin"


def test_verify_rejects_expired_token() -> None:
    exp = datetime.now(UTC) - timedelta(seconds=1)
    payload = {"sub": "1", "tid": None, "role": "owner", "exp": exp}
    expired = jwt.encode(payload, settings.jwt_secret, algorithm=jwt_service.ALGORITHM)
    with pytest.raises(jwt_service.InvalidToken):
        jwt_service.verify(expired)


def test_verify_rejects_garbage() -> None:
    with pytest.raises(jwt_service.InvalidToken):
        jwt_service.verify("not.a.jwt")


def test_verify_rejects_wrong_signature() -> None:
    exp = datetime.now(UTC) + timedelta(hours=1)
    payload = {"sub": "1", "tid": None, "role": "owner", "exp": exp}
    bad = jwt.encode(payload, "different-secret", algorithm=jwt_service.ALGORITHM)
    with pytest.raises(jwt_service.InvalidToken):
        jwt_service.verify(bad)


def test_verify_rejects_missing_role_claim() -> None:
    payload = {"sub": "1", "exp": datetime.now(UTC) + timedelta(hours=1)}
    bad = jwt.encode(payload, settings.jwt_secret, algorithm=jwt_service.ALGORITHM)
    with pytest.raises(jwt_service.InvalidToken):
        jwt_service.verify(bad)
