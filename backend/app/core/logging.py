"""Structured logging with PII scrubbing.

Wraps structlog with a deterministic processor pipeline:
  ColoredConsoleRenderer in dev (readable), JSONRenderer in prod (ingestible
  by Loki/ELK/Datadog).

A custom ``scrub_pii`` processor runs FIRST so that no downstream handler
ever sees raw phone numbers, passport/doc numbers, or photo S3 keys.
This honors the CLAUDE.md rule (§10): "never log contents of *_phone,
*_doc_number, seller_photos, buyer_photos".

Usage::

    from app.core.logging import logger
    logger.info("sale.created", sale_id=42, shop_id=7, buyer_phone="+998901234567")
    # JSON output: {"event": "sale.created", "sale_id": 42, "shop_id": 7,
    #               "buyer_phone": "[scrubbed]"}
"""

from __future__ import annotations

import logging
import re
import sys
from typing import Any

import structlog

from app.core.config import get_settings

# ── PII scrubbing ───────────────────────────────────────────────────────

#: Keys whose VALUES we replace with ``[scrubbed]`` regardless of content.
#: Matched case-insensitively as substrings of the event dict's keys.
_PII_KEY_FRAGMENTS: tuple[str, ...] = (
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

#: Catch-all regex for unstructured phone numbers in free-form strings
#: (e.g. exception messages, raw input echoed in errors).
_PHONE_RE = re.compile(r"\+?\d[\d\s\-()]{7,}\d")

_SCRUBBED = "[scrubbed]"


def _is_pii_key(key: str) -> bool:
    k = key.lower()
    return any(fragment in k for fragment in _PII_KEY_FRAGMENTS)


def _scrub_value(value: Any) -> Any:
    """Recursively replace PII keys / phone-shaped strings inside a value."""
    if isinstance(value, dict):
        return {k: (_SCRUBBED if _is_pii_key(k) else _scrub_value(v)) for k, v in value.items()}
    if isinstance(value, list):
        return [_scrub_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_scrub_value(item) for item in value)
    if isinstance(value, str) and _PHONE_RE.search(value):
        return _PHONE_RE.sub(_SCRUBBED, value)
    return value


def scrub_pii(_logger: Any, _method: str, event_dict: dict[str, Any]) -> dict[str, Any]:
    """structlog processor: redact PII keys and embedded phone numbers."""
    scrubbed: dict[str, Any] = {}
    for k, v in event_dict.items():
        if _is_pii_key(k):
            scrubbed[k] = _SCRUBBED
        else:
            scrubbed[k] = _scrub_value(v)
    return scrubbed


# ── Configuration ───────────────────────────────────────────────────────

_CONFIGURED = False


def configure_logging() -> None:
    """Idempotently configure structlog + stdlib logging.

    Safe to call multiple times — second invocation is a no-op so tests
    that import the app don't double-wire handlers.
    """
    global _CONFIGURED
    if _CONFIGURED:
        return

    settings = get_settings()
    is_prod = settings.is_prod

    # Reset stdlib root handler so structlog owns the output and we don't
    # end up with duplicate lines from uvicorn / sqlalchemy.
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)

    stdlib_handler = logging.StreamHandler(sys.stdout)
    stdlib_handler.setFormatter(logging.Formatter("%(message)s"))
    root.addHandler(stdlib_handler)
    root.setLevel(logging.INFO if is_prod else logging.DEBUG)

    # Tame the chattiest libraries so important events aren't drowned.
    for noisy in ("uvicorn.access", "sqlalchemy.engine", "aiogram.event"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        scrub_pii,  # <- runs before any renderer or remote sink
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    if is_prod:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.INFO if is_prod else logging.DEBUG,
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    _CONFIGURED = True


def get_logger(name: str | None = None) -> structlog.stdlib.BoundLogger:
    configure_logging()
    return structlog.get_logger(name)


#: Module-level convenience: ``from app.core.logging import logger``.
logger = get_logger("malika")


# ── Request-id contextvar bridge ────────────────────────────────────────
# `structlog.contextvars.merge_contextvars` is already in the processor
# pipeline, so anything bound here is auto-attached to every log line
# emitted on the same task. The wrapper returns a small object whose
# `.reset()` unbinds the key so middleware can clean up after the
# response.


class _RequestIDToken:
    """Tiny RAII handle returned by `bind_request_id` — calling `reset()`
    unbinds the key from the structlog contextvars so it doesn't leak
    into other tasks reusing the same async context."""

    __slots__ = ("_keys",)

    def __init__(self, keys: tuple[str, ...]) -> None:
        self._keys = keys

    def reset(self) -> None:
        structlog.contextvars.unbind_contextvars(*self._keys)


def bind_request_id(request_id: str) -> _RequestIDToken:
    """Stamp the current async context with `request_id=<id>` for logs."""
    structlog.contextvars.bind_contextvars(request_id=request_id)
    return _RequestIDToken(("request_id",))
