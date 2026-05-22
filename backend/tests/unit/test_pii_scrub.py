"""PII-scrub processor verifies CLAUDE.md §10 — phone/doc/passport keys
never appear in any log sink.

Lives as a unit test because the processor is pure and shouldn't need a
running DB or MinIO.
"""

from app.core.logging import scrub_pii


def test_scrub_phone_key_replaced():
    out = scrub_pii(None, "info", {"event": "sale", "buyer_phone": "+998901112233"})
    assert out["buyer_phone"] == "[scrubbed]"
    assert out["event"] == "sale"


def test_scrub_doc_number_key_replaced():
    out = scrub_pii(None, "info", {"buyer_doc_number": "AA1234567", "seller_phone": "x"})
    assert out["buyer_doc_number"] == "[scrubbed]"
    assert out["seller_phone"] == "[scrubbed]"


def test_scrub_photo_keys():
    out = scrub_pii(
        None,
        "info",
        {
            "buyer_photos": ["shops/1/sale/abc.jpg"],
            "seller_photos": ["x"],
            "doc_photos": ["y"],
        },
    )
    assert out["buyer_photos"] == "[scrubbed]"
    assert out["seller_photos"] == "[scrubbed]"
    assert out["doc_photos"] == "[scrubbed]"


def test_scrub_password_and_token_keys():
    out = scrub_pii(
        None,
        "info",
        {"password": "hunter2", "api_key": "sk_live_abc", "access_token": "Bearer y"},
    )
    assert out["password"] == "[scrubbed]"
    assert out["api_key"] == "[scrubbed]"
    assert out["access_token"] == "[scrubbed]"


def test_scrub_init_data_key():
    out = scrub_pii(None, "info", {"init_data": "user=%7B..."})
    assert out["init_data"] == "[scrubbed]"


def test_phone_in_freeform_string_redacted():
    msg = "Failed to deliver SMS to +998901112233 due to timeout"
    out = scrub_pii(None, "info", {"event": "sms.failed", "details": msg})
    assert "+998901112233" not in out["details"]
    assert "[scrubbed]" in out["details"]


def test_phone_inside_nested_dict_redacted():
    out = scrub_pii(
        None,
        "info",
        {"event": "x", "payload": {"buyer_phone": "+998900000000", "ok": True}},
    )
    assert out["payload"]["buyer_phone"] == "[scrubbed]"
    assert out["payload"]["ok"] is True


def test_phone_inside_list_redacted():
    out = scrub_pii(
        None,
        "info",
        {"items": [{"phone": "+998900000000"}, {"name": "ok"}]},
    )
    assert out["items"][0]["phone"] == "[scrubbed]"
    assert out["items"][1]["name"] == "ok"


def test_non_pii_keys_untouched():
    out = scrub_pii(
        None,
        "info",
        {"event": "sale.created", "sale_id": 42, "shop_id": 7, "amount": "150000"},
    )
    assert out == {
        "event": "sale.created",
        "sale_id": 42,
        "shop_id": 7,
        "amount": "150000",
    }
