"""Profit calculation — the ONE place that knows the formula.

Reports, dashboards, and unit tests all derive profit through this module.
That guarantees a single, auditable definition of "how much did we make".

Formula:

    profit_uzs = sale_price_uzs - purchase_price_uzs_snapshot

The purchase price is captured as a snapshot at sale time (see ``Sale`` model)
so that editing the original purchase later cannot retroactively rewrite
historical earnings.
"""

from decimal import Decimal

from app.common.money import Currency, quantize


def compute_profit(
    *, sale_price_uzs: Decimal, purchase_price_uzs: Decimal
) -> Decimal:
    """Return profit in UZS, properly rounded.

    Negative results are allowed — selling below purchase price is a real
    scenario (clearing stale stock). The dashboard renders them in red.
    """
    return quantize(sale_price_uzs - purchase_price_uzs, Currency.UZS)
