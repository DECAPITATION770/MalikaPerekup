"""Initialise Sentry for FastAPI. No-op if ``SENTRY_DSN`` env is unset.

Integrations enabled:
* FastAPI / Starlette (auto error capture + transaction tracing)
* SQLAlchemy (slow-query spans)
* Asyncio (background tasks)

Traces sampled at 10% (configurable via ``SENTRY_TRACES_SAMPLE_RATE``).
Phone numbers / doc numbers / passwords are scrubbed by the
``before_send`` hook below — matches ``app.core.logging.scrub_pii``.
"""

from __future__ import annotations

import os
import re
from typing import Any

import sentry_sdk
from sentry_sdk.integrations.asyncio import AsyncioIntegration
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

_PII_KEY_FRAGMENTS = (
    "phone",
    "doc_number",
    "passport",
    "seller_photos",
    "buyer_photos",
    "doc_photos",
    "password",
    "token",
    "secret",
    "api_key",
    "init_data",
)
_PHONE_RE = re.compile(r"\+?\d[\d\s\-()]{7,}\d")
_SCRUBBED = "[scrubbed]"


def _is_pii_key(key: str) -> bool:
    return any(f in key.lower() for f in _PII_KEY_FRAGMENTS)


def _scrub(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: (_SCRUBBED if _is_pii_key(k) else _scrub(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub(v) for v in value]
    if isinstance(value, str) and _PHONE_RE.search(value):
        return _PHONE_RE.sub(_SCRUBBED, value)
    return value


def _before_send(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any] | None:
    """Strip PII before the event leaves the process."""
    if "request" in event and isinstance(event["request"], dict):
        event["request"] = _scrub(event["request"])
    if "extra" in event:
        event["extra"] = _scrub(event["extra"])
    if "user" in event and isinstance(event["user"], dict):
        # Keep only id / username — drop ip_address etc. by recreating dict.
        u = event["user"]
        event["user"] = {k: u[k] for k in ("id", "username") if k in u}
    return event


_INITIALISED = False


def init_sentry() -> None:
    """Boot Sentry. Idempotent — second call is a no-op."""
    global _INITIALISED
    if _INITIALISED:
        return

    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        # No DSN — keep Sentry's `capture_*` calls as no-ops in dev.
        _INITIALISED = True
        return

    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("ENVIRONMENT", "dev"),
        release=os.environ.get("APP_VERSION") or None,
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1")),
        send_default_pii=False,  # extra safety; we also scrub manually
        integrations=[
            StarletteIntegration(),
            FastApiIntegration(),
            SqlalchemyIntegration(),
            AsyncioIntegration(),
        ],
        before_send=_before_send,
    )
    _INITIALISED = True
