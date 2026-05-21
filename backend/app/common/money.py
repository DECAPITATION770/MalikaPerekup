"""Money helpers: ``Decimal``-based math, no floats.

Why ``Decimal``? Floating-point loses precision on simple sums (``0.1 + 0.2``
is not ``0.3``). For real money this becomes audit nightmares. Every monetary
value in the codebase passes through these helpers.

UZS is treated as integer (whole сум, no тийин — nobody uses them in 2025).
USD keeps two decimal places. The rate UZS-per-USD is fixed at deal time
and stored on the deal itself, never recomputed retroactively.
"""

from decimal import ROUND_HALF_UP, Decimal
from enum import StrEnum

UZS_QUANTUM = Decimal("1")          # whole сум
USD_QUANTUM = Decimal("0.01")       # cents


class Currency(StrEnum):
    UZS = "UZS"
    USD = "USD"


def quantize(amount: Decimal, currency: Currency) -> Decimal:
    """Round ``amount`` to the precision used for ``currency``."""
    quantum = USD_QUANTUM if currency is Currency.USD else UZS_QUANTUM
    return amount.quantize(quantum, rounding=ROUND_HALF_UP)


def to_uzs(amount: Decimal, currency: Currency, exchange_rate: Decimal) -> Decimal:
    """Convert any currency to UZS using the given rate.

    ``exchange_rate`` = how many UZS per 1 unit of ``currency``. For UZS the
    rate is ignored.
    """
    if currency is Currency.UZS:
        return quantize(amount, Currency.UZS)
    return quantize(amount * exchange_rate, Currency.UZS)


def format_amount(amount: Decimal, currency: Currency) -> str:
    """Render an amount with thousand separators and a currency suffix.

    Examples:
        ``format_amount(Decimal('1200000'), Currency.UZS)``  →  ``'1 200 000 сум'``
        ``format_amount(Decimal('350.00'), Currency.USD)``   →  ``'$350.00'``
    """
    amount = quantize(amount, currency)
    if currency is Currency.USD:
        return f"${amount:,.2f}".replace(",", " ")
    return f"{int(amount):,} сум".replace(",", " ")
