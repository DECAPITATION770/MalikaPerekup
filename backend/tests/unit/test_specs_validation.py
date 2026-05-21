"""devices.specs.validate_specs — per-category Pydantic gate.

Unit test (no DB). Verifies that the wizard's submitted ``specs`` are
filtered to known keys per category, rejected on out-of-range values,
and emptied to ``{}`` when nothing meaningful was filled.
"""

import pytest

from app.features.devices.specs import SpecsValidationError, validate_specs


def test_empty_specs_passes_through_as_empty():
    assert validate_specs("phone", {}) == {}
    assert validate_specs("other", {}) == {}


def test_phone_valid_specs_normalised():
    cleaned = validate_specs("phone", {
        "ram_gb": 8, "storage_gb": 256, "color": "Чёрный", "battery_health_pct": 88,
    })
    assert cleaned == {
        "ram_gb": 8, "storage_gb": 256, "color": "Чёрный", "battery_health_pct": 88,
    }


def test_phone_none_fields_stripped():
    """Keys the user left empty don't get persisted — keeps the JSON tidy."""
    cleaned = validate_specs("phone", {
        "ram_gb": 8, "storage_gb": None, "color": None, "battery_health_pct": None,
    })
    assert cleaned == {"ram_gb": 8}


def test_phone_rejects_unknown_key():
    """``extra='forbid'`` — typos can't sneak into the DB."""
    with pytest.raises(SpecsValidationError):
        validate_specs("phone", {"cpu": "Snapdragon"})


def test_phone_rejects_out_of_range():
    with pytest.raises(SpecsValidationError):
        validate_specs("phone", {"ram_gb": 0})
    with pytest.raises(SpecsValidationError):
        validate_specs("phone", {"battery_health_pct": 101})
    with pytest.raises(SpecsValidationError):
        validate_specs("phone", {"battery_health_pct": 0})


def test_laptop_has_cpu_field():
    cleaned = validate_specs("laptop", {
        "ram_gb": 16, "cpu": "M3 Pro", "screen_inches": 14.0,
    })
    assert cleaned == {"ram_gb": 16, "cpu": "M3 Pro", "screen_inches": 14.0}


def test_laptop_rejects_phone_field():
    """Phones have battery_health_pct; laptops don't track it the same way."""
    with pytest.raises(SpecsValidationError):
        validate_specs("laptop", {"battery_health_pct": 80})


def test_tablet_uses_phone_schema():
    cleaned = validate_specs("tablet", {"ram_gb": 8, "storage_gb": 256})
    assert cleaned == {"ram_gb": 8, "storage_gb": 256}


def test_smartwatch_connectivity_list():
    cleaned = validate_specs("smartwatch", {
        "color": "Чёрный", "battery_health_pct": 92, "connectivity": ["gps", "lte"],
    })
    assert cleaned["connectivity"] == ["gps", "lte"]
    assert cleaned["color"] == "Чёрный"
    assert cleaned["battery_health_pct"] == 92


def test_accessory_minimal():
    cleaned = validate_specs("accessory", {"color": "Белый"})
    assert cleaned == {"color": "Белый"}


def test_other_accepts_arbitrary_string_kvs():
    """``other`` is the catch-all — anything string is kept."""
    cleaned = validate_specs("other", {"feature": "vintage", "year": "2019"})
    assert cleaned == {"feature": "vintage", "year": "2019"}


def test_other_stringifies_non_string_values():
    cleaned = validate_specs("other", {"version": 2})
    assert cleaned == {"version": "2"}


def test_unknown_category_raises():
    with pytest.raises(SpecsValidationError):
        validate_specs("spaceship", {"warp": 9})
