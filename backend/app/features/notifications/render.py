"""Render a notification payload into plain text in the user's language.

Single source of truth for "what the user reads". Channels reuse this so
SMS / push / email get the same wording (later truncated for SMS).
"""

from decimal import Decimal
from typing import Any

from app.common.i18n import Language, t
from app.common.money import Currency, format_amount
from app.features.notifications.models import Notification, NotificationKind


def _fmt_uzs(value: Any) -> str:
    """Coerce a JSON-serialised amount back to ``Decimal`` and format."""
    if value is None:
        return format_amount(Decimal("0"), Currency.UZS)
    return format_amount(Decimal(str(value)), Currency.UZS)


def render(notification: Notification, *, lang: Language) -> str:
    """Return the body text for ``notification`` in the chosen language."""
    payload = notification.payload or {}
    kind = notification.kind

    if kind == NotificationKind.DAILY_SUMMARY.value:
        if lang == "uz":
            return (
                "🌅 Xayrli tong!\n\n"
                f"Bugungi to'lovlar: {payload.get('payments_count', 0)} ta\n"
                f"Kutilayotgan summa: {_fmt_uzs(payload.get('total_due'))}\n"
                f"Muddati o'tgan: {payload.get('overdue_count', 0)} ta"
            )
        return (
            "🌅 Доброе утро!\n\n"
            f"Платежей сегодня: {payload.get('payments_count', 0)}\n"
            f"Ожидаемая сумма: {_fmt_uzs(payload.get('total_due'))}\n"
            f"Просроченных: {payload.get('overdue_count', 0)}"
        )

    if kind == NotificationKind.PAYMENT_DUE_TODAY.value:
        if lang == "uz":
            return (
                "⏰ Bugun to'lov:\n"
                f"{payload.get('buyer_name', '—')} — {_fmt_uzs(payload.get('amount_due'))}\n"
                f"Qurilma: {payload.get('device', '—')}\n"
                f"Telefon: {payload.get('buyer_phone') or '—'}"
            )
        return (
            "⏰ Сегодня платёж:\n"
            f"{payload.get('buyer_name', '—')} — {_fmt_uzs(payload.get('amount_due'))}\n"
            f"Устройство: {payload.get('device', '—')}\n"
            f"Телефон: {payload.get('buyer_phone') or '—'}"
        )

    if kind == NotificationKind.PAYMENT_OVERDUE.value:
        if lang == "uz":
            return (
                "⚠️ To'lov muddati o'tdi:\n"
                f"{payload.get('buyer_name', '—')} — {_fmt_uzs(payload.get('amount_due'))}\n"
                f"Qurilma: {payload.get('device', '—')}\n"
                f"Telefon: {payload.get('buyer_phone') or '—'}\n"
                f"Umumiy qarz: {_fmt_uzs(payload.get('remaining'))}"
            )
        return (
            "⚠️ Просрочен платёж:\n"
            f"{payload.get('buyer_name', '—')} — {_fmt_uzs(payload.get('amount_due'))}\n"
            f"Устройство: {payload.get('device', '—')}\n"
            f"Телефон: {payload.get('buyer_phone') or '—'}\n"
            f"Общий долг: {_fmt_uzs(payload.get('remaining'))}"
        )

    # Unknown kind — fall back to translated key so the message still goes out.
    return t(f"notifications.{kind}", lang=lang)
