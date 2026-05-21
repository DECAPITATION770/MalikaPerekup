"""QR token generation and PNG rendering.

Each device gets one QR token at creation time. The token is a random UUID4
hex string — 128 bits of entropy means it cannot be guessed. Access control
is enforced at the API layer (``device.shop_id == current_user.shop_id``),
so no signature is needed: even if a token leaks, only the owning shop can
fetch the device.

Scanning the QR opens ``{BOT_WEBAPP_URL}/d/{token}`` — the device card with
characteristics and full movement history (purchase, sale, installments).
"""

from io import BytesIO
from uuid import uuid4

import qrcode

from app.core.config import get_settings


def generate_qr_token() -> str:
    """Return a fresh 32-character hex token for a new device."""
    return uuid4().hex


def device_url(token: str) -> str:
    """Build the public URL embedded into the QR image."""
    base = get_settings().bot_webapp_url.rstrip("/")
    return f"{base}/d/{token}"


def render_qr_png(token: str) -> bytes:
    """Render the QR code for ``token`` as PNG bytes (ready to send/print)."""
    img = qrcode.make(device_url(token))
    buffer = BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()
