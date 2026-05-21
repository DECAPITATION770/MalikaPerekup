"""Device business logic.

Two responsibilities:
* enforce status transitions (``in_stock`` → ``sold``, never ``sold`` → ``in_stock``);
* be the single place that constructs a ``Device`` row, called by the
  ``purchases`` service when a new acquisition is registered.
"""

from datetime import timedelta
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.common.dates import now_utc
from app.common.qr import generate_qr_token
from app.features.devices import repository as repo
from app.features.devices.models import Device, DeviceStatus

# Time window during which any field can still be edited freely. After it
# expires, only "notes" can be added — see ``CLAUDE.md`` rule about audit log.
EDIT_WINDOW = timedelta(hours=24)

# Allowed status transitions (anything not listed is rejected).
_ALLOWED_TRANSITIONS: dict[str, set[str]] = {
    DeviceStatus.IN_STOCK.value: {
        DeviceStatus.RESERVED.value,
        DeviceStatus.SOLD.value,
        DeviceStatus.WRITTEN_OFF.value,
    },
    DeviceStatus.RESERVED.value: {
        DeviceStatus.IN_STOCK.value,
        DeviceStatus.SOLD.value,
    },
    DeviceStatus.SOLD.value: {
        DeviceStatus.RETURNED.value,
    },
    DeviceStatus.RETURNED.value: {
        DeviceStatus.IN_STOCK.value,
        DeviceStatus.WRITTEN_OFF.value,
    },
}


class DeviceError(Exception):
    """Service-level errors mapped to HTTP by the router."""


class DeviceNotFound(DeviceError):
    pass


class ImeiAlreadyExists(DeviceError):
    """Another device with this IMEI is already registered in the shop."""


class IllegalStatusTransition(DeviceError):
    """The requested ``status`` change is not allowed from the current one."""


class EditWindowExpired(DeviceError):
    """Editing of a row older than ``EDIT_WINDOW`` is not allowed."""


async def get_or_404(db: AsyncSession, device_id: int, *, shop_id: int) -> Device:
    device = await repo.get_by_id(db, device_id, shop_id=shop_id)
    if device is None:
        raise DeviceNotFound("device not found")
    return device


async def get_by_token_or_404(
    db: AsyncSession, qr_token: str, *, shop_id: int
) -> Device:
    """Used by the QR scanner — looks up by token then verifies shop."""
    device = await repo.get_by_token(db, qr_token)
    if device is None or device.shop_id != shop_id:
        # Same 404 for "not in our shop" as for "does not exist" — do not
        # leak the existence of devices belonging to other shops.
        raise DeviceNotFound("device not found")
    return device


async def create_for_purchase(
    db: AsyncSession,
    *,
    shop_id: int,
    created_by: int,
    category: str,
    brand: str,
    model: str,
    imei: str | None,
    serial: str | None,
    condition: str,
    specs: dict[str, Any] | None,
    photos: list[str] | None,
    defects: list[str] | None,
    notes: str | None,
) -> Device:
    """Build and insert a new device. Called by ``purchases.service``.

    Pre-checks IMEI uniqueness so the user gets a friendly 409 instead of
    a database constraint error.
    """
    if imei:
        existing = await repo.get_by_imei(db, imei, shop_id=shop_id)
        if existing is not None:
            raise ImeiAlreadyExists(f"device with IMEI {imei} already exists")

    device = Device(
        shop_id=shop_id,
        category=category,
        brand=brand,
        model=model,
        imei=imei,
        serial=serial,
        condition=condition,
        specs=specs or {},
        photos=photos or [],
        defects=defects or [],
        status=DeviceStatus.IN_STOCK.value,
        qr_token=generate_qr_token(),
        notes=notes,
        created_by=created_by,
    )
    return await repo.add(db, device)


def _is_within_edit_window(device: Device) -> bool:
    return now_utc() - device.created_at <= EDIT_WINDOW


async def update(
    db: AsyncSession,
    device: Device,
    **patch,
) -> Device:
    """Apply a partial update with the 24-hour rule.

    Outside the window, only ``notes`` may change — that lets users add
    context (``"возврат принял лично"``) without rewriting history.
    """
    if not _is_within_edit_window(device):
        forbidden = {k for k, v in patch.items() if v is not None and k != "notes"}
        if forbidden:
            raise EditWindowExpired(
                "deal is older than 24 hours — only 'notes' can be edited"
            )

    if patch.get("imei") and patch["imei"] != device.imei:
        clash = await repo.get_by_imei(db, patch["imei"], shop_id=device.shop_id)
        if clash is not None and clash.id != device.id:
            raise ImeiAlreadyExists(
                f"device with IMEI {patch['imei']} already exists"
            )

    for field, value in patch.items():
        if value is not None:
            setattr(device, field, value)
    return device


def transition_status(device: Device, new_status: str) -> None:
    """Mutate ``device.status`` if the transition is allowed.

    Called from the sales / installment / inventory features — never
    exposed via the devices router directly.
    """
    allowed = _ALLOWED_TRANSITIONS.get(device.status, set())
    if new_status not in allowed:
        raise IllegalStatusTransition(
            f"cannot move device from {device.status!r} to {new_status!r}"
        )
    device.status = new_status
