"""Prometheus metrics — RED + latency histograms via instrumentator.

Exposes ``/internal/metrics`` (not under ``/api/v1``) so the scraper can
hit it without going through the public API surface. The endpoint is
unauthenticated; restrict at the reverse-proxy layer in prod.
"""

from __future__ import annotations

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

# Module-level so it survives FastAPI re-instantiation in tests.
_instrumentator: Instrumentator | None = None


def setup_metrics(app: FastAPI) -> None:
    """Attach instrumentation and expose ``/internal/metrics``."""
    global _instrumentator
    if _instrumentator is not None:
        return

    _instrumentator = (
        Instrumentator(
            should_group_status_codes=True,
            should_ignore_untemplated=True,
            excluded_handlers=["/health", "/internal/metrics"],
        )
        .instrument(app)
        .expose(app, endpoint="/internal/metrics", include_in_schema=False)
    )
