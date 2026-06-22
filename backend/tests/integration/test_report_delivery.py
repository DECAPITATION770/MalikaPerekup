"""Unit tests for Telegram report delivery (no DB needed)."""

import pytest

from app.features.auth.models import User
from app.features.reports.delivery import ReportDeliveryError, send_xlsx


class _FakeBot:
    """Captures send_document calls."""

    def __init__(self) -> None:
        self.calls: list[tuple] = []

    async def send_document(self, chat_id, document, caption=None):
        self.calls.append((chat_id, document, caption))


@pytest.mark.asyncio
async def test_send_xlsx_goes_to_user_tg_id():
    bot = _FakeBot()
    user = User(full_name="U", tg_id=555)
    await send_xlsx(bot, user, content=b"PK\x03\x04", filename="r.xlsx", caption="cap")
    chat_id, document, caption = bot.calls[0]
    assert chat_id == 555
    assert document.filename == "r.xlsx"
    assert caption == "cap"


@pytest.mark.asyncio
async def test_send_xlsx_prefers_notify_chat_id():
    bot = _FakeBot()
    user = User(full_name="U", tg_id=555, notify_tg_chat_id=999)
    await send_xlsx(bot, user, content=b"PK", filename="r.xlsx", caption="cap")
    assert bot.calls[0][0] == 999


@pytest.mark.asyncio
async def test_send_xlsx_without_chat_id_raises():
    bot = _FakeBot()
    user = User(full_name="U")  # no tg_id, no notify chat
    with pytest.raises(ReportDeliveryError):
        await send_xlsx(bot, user, content=b"PK", filename="r.xlsx", caption="cap")
    assert bot.calls == []
