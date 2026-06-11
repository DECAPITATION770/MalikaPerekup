"""Redis-backed fixed-window rate limiter used by the auth endpoints.

A login is the highest-value endpoint for a brute-force attacker — every
failure is cheap, every success unlocks a tenant's data. We don't depend
on slowapi (extra dep, ad-hoc decorator API); instead a tiny Redis INCR
+ EXPIRE counter does the job in ~10 lines.

The limiter is a *fixed-window* per (route, identifier) — simpler and
cheaper than sliding-window for a low-traffic admin/auth surface where
a small burst at the window boundary is acceptable. Two windows protect
both the user (slow per-account guessing) and the network (per-IP DDoS).

Each window is keyed by a `scope` (caller-supplied — usually the route
name) and an `identifier` (IP or username). Failures of Redis itself
fail OPEN — we'd rather serve traffic during a Redis outage than lock
every user out. Counterpoint logged at WARNING so it's visible in
dashboards.
"""

from __future__ import annotations

import redis.asyncio as aioredis
from fastapi import HTTPException, Request, status

from app.core.config import get_settings
from app.core.logging import logger

_pool: aioredis.Redis | None = None


def _redis() -> aioredis.Redis:
    """Lazy singleton — `Redis.from_url` is cheap but we only need it once."""
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            str(get_settings().redis_url), decode_responses=True
        )
    return _pool


async def _check(scope: str, identifier: str, limit: int, window_seconds: int) -> None:
    """Increment the counter for one (scope, identifier) pair. Raise 429
    when over the limit. Failures of Redis itself fail OPEN — see module
    docstring for rationale."""
    key = f"rl:{scope}:{identifier}"
    try:
        # Pipelined INCR + EXPIRE so the TTL gets set once per window.
        # `nx=True` keeps the existing TTL on subsequent hits.
        async with _redis().pipeline(transaction=False) as pipe:
            pipe.incr(key)
            pipe.expire(key, window_seconds, nx=True)
            count, _ = await pipe.execute()
    except Exception as exc:  # noqa: BLE001 — never block traffic on Redis flakes
        logger.warning("ratelimit.redis_unavailable", scope=scope, error=str(exc))
        return

    if int(count) > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Try again later.",
            headers={"Retry-After": str(window_seconds)},
        )


def _client_ip(request: Request) -> str:
    """Best-effort client IP — trusts the first hop of `X-Forwarded-For`
    when present (we run behind a reverse proxy in prod). Falls back to
    the socket peer for direct dev requests."""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def login_rate_limit(
    scope: str = "auth.login",
    *,
    per_ip_limit: int = 10,
    per_ip_window: int = 60,
):
    """FastAPI dependency factory: throttle login attempts.

    Defaults: 10 attempts per IP per minute — enough for a fat-fingered
    sysadmin, far below the rate a brute-force script needs to be
    effective. Tighten per-route if a stricter policy is warranted.
    """

    # `Request` is a FastAPI sentinel type — wrapping it in `Depends()`
    # would make FastAPI treat the parameter as a request-body field,
    # which is what broke /auth/login with a 422 "Field required: scope".
    async def _dep(request: Request) -> None:
        ip = _client_ip(request)
        await _check(scope, ip, per_ip_limit, per_ip_window)

    return _dep
