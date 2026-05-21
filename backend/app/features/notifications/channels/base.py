"""Channel interface — every transport (Telegram, SMS, push, email) implements it.

The dispatcher is channel-agnostic: it picks rows from the outbox and
hands each to the channel matching ``notification.channel``. Adding a
new transport later means only writing a new ``Channel`` subclass and
registering it in ``service.CHANNELS``.
"""

from typing import Protocol

from app.features.auth.models import User
from app.features.notifications.models import Notification


class ChannelError(Exception):
    """Wraps any transport-specific failure into one type for the dispatcher."""


class Channel(Protocol):
    """Abstract sender — duck-typed so subclasses don't need a base class import."""

    code: str
    """Matches ``Notification.channel`` (e.g. ``"telegram"``)."""

    async def send(self, notification: Notification, user: User, text: str) -> None:
        """Deliver ``text`` to ``user`` via this channel.

        Raise ``ChannelError`` on permanent failure (user blocked us, no
        contact info on file). Network blips should also raise so the
        dispatcher can retry.
        """
        ...
