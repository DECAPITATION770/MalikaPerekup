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

USER app
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
