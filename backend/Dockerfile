# syntax=docker/dockerfile:1.7
# Two-stage build: install dependencies with uv, then copy into a slim runtime.

# ─── Builder stage ──────────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:0.5-python3.12-bookworm-slim AS builder

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never

WORKDIR /app

# Install dependencies first so Docker can cache the heavy layer separately
# from source-code changes.
COPY pyproject.toml uv.lock* ./
RUN --mount=type=cache,target=/root/.cache/uv \
    (uv sync --frozen --no-install-project --no-dev || \
     uv sync --no-install-project --no-dev)

# Copy source and install the project itself.
COPY app ./app
COPY bot ./bot
COPY alembic ./alembic
COPY alembic.ini ./
RUN --mount=type=cache,target=/root/.cache/uv uv sync --no-dev

# ─── Runtime stage ──────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

RUN useradd --create-home --shell /bin/bash app
WORKDIR /app

COPY --from=builder --chown=app:app /app /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# pg_dump / pg_restore (версия 16 под сервер PG16) из официального PGDG repo —
# нужны для системы бэкапа (app/features/backup).
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg lsb-release \
    && install -d /usr/share/postgresql-common/pgdg \
    && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
        -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
    && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*

# Backup target (BACKUP_DIR, default /backups). Create it owned by `app` so a
# freshly-created named volume mounted here inherits app ownership — otherwise
# Docker makes the mountpoint root-owned and the non-root app user gets
# "Permission denied" on the first backup.
RUN mkdir -p /backups && chown app:app /backups
VOLUME /backups

USER app
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
