from datetime import date
from types import SimpleNamespace

from app.features.admin.service import client_status

TODAY = date(2026, 6, 13)


def _shop(plan="basic", plan_until=None, is_frozen=False):
    return SimpleNamespace(plan=plan, plan_until=plan_until, is_frozen=is_frozen)


def test_no_shop():
    assert client_status(None, TODAY) == "no_shop"


def test_frozen_takes_priority():
    assert client_status(_shop(plan="basic", is_frozen=True), TODAY) == "frozen"


def test_expired():
    assert client_status(_shop(plan="basic", plan_until=date(2026, 6, 1)), TODAY) == "expired"


def test_client_basic_active():
    assert client_status(_shop(plan="basic", plan_until=date(2026, 12, 1)), TODAY) == "client"


def test_trial():
    assert client_status(_shop(plan="trial"), TODAY) == "trial"
