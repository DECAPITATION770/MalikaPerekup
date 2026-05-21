"""Response shape for ``GET /reports/exchange-rate-hint``.

``Decimal`` is serialised as a JSON string by Pydantic, so the frontend
never sees floating-point drift (same convention as ``reports.schemas``).
"""

from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class RateSource(BaseModel):
    rate: Decimal
    """UZS per 1 USD."""

    as_of: date
    """``last_used``: that purchase's date. ``cb_uz``: the CBU publish date."""

    stale: bool = False
    """``cb_uz`` only — True when the cached CBU date is before today
    (cbu.uz was unreachable on the last scheduler run)."""


class ExchangeRateHint(BaseModel):
    """Both suggestions; either side is ``null`` when unavailable."""

    last_used: RateSource | None
    cb_uz: RateSource | None
