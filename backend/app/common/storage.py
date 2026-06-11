"""Object storage for photos (passports, devices, receipts).

Backend is MinIO locally and Cloudflare R2 / S3 in production — both speak
the same S3 API. Photos are PII (паспорта продавцов и покупателей), so:

* the bucket is private — never expose direct URLs;
* downloads always go through short-lived presigned URLs (≤ 15 min);
* keys include ``shop_id`` so accidental cross-shop access is impossible.
"""

from datetime import timedelta
from functools import lru_cache
from io import BytesIO
from typing import BinaryIO
from uuid import uuid4

from minio import Minio

from app.core.config import get_settings

PRESIGNED_URL_TTL = timedelta(minutes=15)


def _clamp_ttl(ttl: timedelta) -> timedelta:
    """Clamp a caller-supplied TTL to the global ceiling.

    CLAUDE.md §10 mandates ≤ 15 min for PII downloads. A caller asking for
    a longer URL is either a bug or an attempt to widen the window; either
    way we silently truncate rather than honour it. Negative / zero TTLs
    fall through to the default so callers can't accidentally mint a URL
    that's instantly expired.
    """
    if ttl <= timedelta(0):
        return PRESIGNED_URL_TTL
    return min(ttl, PRESIGNED_URL_TTL)


@lru_cache
def _client() -> Minio:
    """Singleton MinIO client used for server-side ops (upload/delete) —
    talks to the storage over the *internal* endpoint."""
    settings = get_settings()
    return Minio(
        endpoint=settings.s3_endpoint,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        region=settings.s3_region,
        secure=settings.s3_secure,
    )


@lru_cache
def _public_client() -> Minio:
    """MinIO client whose signatures are bound to the *public* endpoint —
    the host the browser can actually reach. Falls back to the internal
    endpoint when no public override is configured (single-host prod)."""
    settings = get_settings()
    if not settings.s3_public_endpoint:
        return _client()
    return Minio(
        endpoint=settings.s3_public_endpoint,
        access_key=settings.s3_access_key,
        secret_key=settings.s3_secret_key,
        region=settings.s3_region,
        secure=(
            settings.s3_public_secure
            if settings.s3_public_secure is not None
            else settings.s3_secure
        ),
    )


def ensure_bucket() -> None:
    """Create the bucket on first run if it does not exist yet."""
    client = _client()
    bucket = get_settings().s3_bucket
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)


def build_key(shop_id: int, scope: str, filename: str) -> str:
    """Build a stable storage key — ``shop_id`` first prevents cross-shop access."""
    return f"shops/{shop_id}/{scope}/{filename}"


def upload(key: str, data: bytes, content_type: str) -> str:
    """Upload ``data`` under ``key`` and return the key."""
    settings = get_settings()
    stream: BinaryIO = BytesIO(data)
    _client().put_object(
        bucket_name=settings.s3_bucket,
        object_name=key,
        data=stream,
        length=len(data),
        content_type=content_type,
    )
    return key


def presigned_url(key: str, ttl: timedelta = PRESIGNED_URL_TTL) -> str:
    """Return a temporary HTTPS URL that expires after ``ttl`` (clamped)."""
    return _public_client().presigned_get_object(
        bucket_name=get_settings().s3_bucket,
        object_name=key,
        expires=_clamp_ttl(ttl),
    )


def build_upload_key(shop_id: int, scope: str, filename: str) -> str:
    """Unique storage key for a Mini-App upload; UUID prefix guarantees no
    collisions even if two clients pick the same filename concurrently."""
    safe = filename.replace("/", "_").replace("\\", "_")[:80] or "file"
    return f"shops/{shop_id}/{scope}/{uuid4().hex}-{safe}"


def presigned_put_url(key: str, ttl: timedelta = PRESIGNED_URL_TTL) -> str:
    """Return a temporary HTTPS URL that the Mini App PUTs the file to —
    the file never traverses the API server (offload to MinIO/R2). The
    TTL is clamped to PRESIGNED_URL_TTL even if the caller asks for more."""
    return _public_client().presigned_put_object(
        bucket_name=get_settings().s3_bucket,
        object_name=key,
        expires=_clamp_ttl(ttl),
    )


def delete(key: str) -> None:
    """Remove an object — used when a deal is hard-deleted by Owner."""
    _client().remove_object(get_settings().s3_bucket, key)
