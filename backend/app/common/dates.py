"""Date and time helpers, all anchored to ``Asia/Tashkent``.

Rule of thumb: store everything in UTC, display and calculate user-visible
boundaries (today, this month, due dates) in Tashkent time. The shop owner
thinks in local time — the database thinks in UTC.
"""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

TASHKENT = ZoneInfo("Asia/Tashkent")
UTC = ZoneInfo("UTC")


def now_utc() -> datetime:
    """Current time as a timezone-aware UTC datetime."""
    return datetime.now(tz=UTC)


def now_tashkent() -> datetime:
    """Current local time in Tashkent (timezone-aware)."""
    return datetime.now(tz=TASHKENT)


def today_tashkent() -> date:
    """Today's date in Tashkent time — used for dashboards and reports."""
    return now_tashkent().date()


def to_tashkent(dt: datetime) -> datetime:
    """Convert any aware datetime to Tashkent local time."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return dt.astimezone(TASHKENT)


def to_utc(dt: datetime) -> datetime:
    """Convert any aware datetime to UTC for storage."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=TASHKENT)
    return dt.astimezone(UTC)


def start_of_day(d: date) -> datetime:
    """Return the UTC instant of midnight in Tashkent on ``d``."""
    return datetime.combine(d, time.min, tzinfo=TASHKENT).astimezone(UTC)


def end_of_day(d: date) -> datetime:
    """Return the UTC instant just before midnight in Tashkent on ``d``."""
    return datetime.combine(d, time.max, tzinfo=TASHKENT).astimezone(UTC)


def days_ago(n: int) -> date:
    """Return the date ``n`` days before today in Tashkent."""
    return today_tashkent() - timedelta(days=n)
