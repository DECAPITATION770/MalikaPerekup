"""CBU rate fetching and the exchange-rate hint shown on the purchase form.

Two independent sources feed the hint:

* **last_used** — the rate this shop typed on its most recent USD purchase
  (shop-scoped, so a brand-new shop has none);
* **cb_uz** — the official Central Bank of Uzbekistan rate, mirrored daily
  into ``cbu_rate_cache`` by a scheduler job.

If cbu.uz is unreachable the cache simply ages: the hint reports the old
value with ``stale=True`` instead of disappearing. When both sources are
empty the hint is ``{null, null}`` and the form shows no suggestions.
"""

from datetime import date, datetime
from decimal import Decimal, InvalidOperation

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import today_tashkent
from app.core.logging import logger
from app.features.exchange import repository as repo
from app.features.exchange.schemas import ExchangeRateHint, RateSource

CBU_USD_URL = "https://cbu.uz/oz/arkhiv-kursov-valyut/json/USD/"
_FETCH_TIMEOUT = httpx.Timeout(10.0)


class CbuParseError(ValueError):
    """The cbu.uz payload was missing or not in the expected shape."""


def parse_cbu_payload(payload: object) -> tuple[date, Decimal]:
    """Extract ``(rate_date, usd_rate)`` from the cbu.uz JSON array.

    cbu.uz returns a one-element list for ``/json/USD/``::

        [{"Ccy": "USD", "Rate": "12846.43", "Date": "16.05.2026", ...}]

    Raises ``CbuParseError`` for anything that does not fit, so the caller
    can keep the previous cached value rather than store garbage.
    """
    if not isinstance(payload, list) or not payload:
        raise CbuParseError("expected a non-empty JSON array")
    row = payload[0]
    if not isinstance(row, dict):
        raise CbuParseError("first element is not an object")
    try:
        usd_rate = Decimal(str(row["Rate"]))
        rate_date = datetime.strptime(row["Date"], "%d.%m.%Y").date()
    except (KeyError, ValueError, InvalidOperation) as exc:
        raise CbuParseError(f"bad Rate/Date field: {exc}") from exc
    if usd_rate <= 0:
        raise CbuParseError("non-positive rate")
    return rate_date, usd_rate


async def fetch_cbu_usd_rate(
    client: httpx.AsyncClient | None = None,
) -> tuple[date, Decimal]:
    """Fetch and parse the current USD rate from cbu.uz.

    ``client`` is injectable for tests; in production a short-lived one is
    opened here. Network/parse failures propagate to the caller.
    """
    owns_client = client is None
    client = client or httpx.AsyncClient(timeout=_FETCH_TIMEOUT)
    try:
        resp = await client.get(CBU_USD_URL)
        resp.raise_for_status()
        return parse_cbu_payload(resp.json())
    finally:
        if owns_client:
            await client.aclose()


async def refresh_cbu_rate(db: AsyncSession) -> None:
    """Scheduler job body: fetch the CBU rate and cache it.

    Never raises — a flaky cbu.uz must not crash the scheduler. The cache
    keeps its previous (now stale) value until the next successful run.
    """
    try:
        rate_date, usd_rate = await fetch_cbu_usd_rate()
    except (httpx.HTTPError, CbuParseError) as exc:
        # Keyed structlog call routes through the PII-scrubbing processor;
        # the %-style version bypassed it because the message was already
        # formatted by the stdlib logger.
        logger.warning("cbu.refresh_failed", error=str(exc), error_type=type(exc).__name__)
        return
    await repo.upsert_cbu_rate(db, rate_date=rate_date, usd_rate=usd_rate)


async def exchange_rate_hint(
    db: AsyncSession, *, shop_id: int
) -> ExchangeRateHint:
    """Build the two-source hint for the purchase form's rate field."""
    last_used: RateSource | None = None
    lu = await repo.last_used_rate(db, shop_id=shop_id)
    if lu is not None:
        rate, as_of = lu
        last_used = RateSource(rate=rate, as_of=as_of, stale=False)

    cb_uz: RateSource | None = None
    cached = await repo.latest_cbu_rate(db)
    if cached is not None:
        cb_uz = RateSource(
            rate=cached.usd_rate,
            as_of=cached.date,
            stale=cached.date < today_tashkent(),
        )

    return ExchangeRateHint(last_used=last_used, cb_uz=cb_uz)
