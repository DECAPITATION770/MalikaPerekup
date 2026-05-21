"""cbu.uz payload parsing — pure function, no network, no DB."""

from datetime import date
from decimal import Decimal

import pytest

from app.features.exchange.service import CbuParseError, parse_cbu_payload

# Shape cbu.uz actually returns for /oz/arkhiv-kursov-valyut/json/USD/.
VALID = [
    {
        "id": 69,
        "Code": "840",
        "Ccy": "USD",
        "CcyNm_RU": "Доллар США",
        "Nominal": "1",
        "Rate": "12846.43",
        "Diff": "5.66",
        "Date": "16.05.2026",
    }
]


def test_parses_valid_payload():
    rate_date, usd_rate = parse_cbu_payload(VALID)
    assert rate_date == date(2026, 5, 16)
    assert usd_rate == Decimal("12846.43")


def test_empty_list_rejected():
    with pytest.raises(CbuParseError):
        parse_cbu_payload([])


def test_non_list_rejected():
    with pytest.raises(CbuParseError):
        parse_cbu_payload({"Rate": "1", "Date": "16.05.2026"})


def test_missing_rate_field_rejected():
    with pytest.raises(CbuParseError):
        parse_cbu_payload([{"Date": "16.05.2026"}])


def test_bad_date_format_rejected():
    with pytest.raises(CbuParseError):
        parse_cbu_payload([{"Rate": "12846.43", "Date": "2026-05-16"}])


def test_non_positive_rate_rejected():
    with pytest.raises(CbuParseError):
        parse_cbu_payload([{"Rate": "0", "Date": "16.05.2026"}])
