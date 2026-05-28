from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.config import settings
from app.features.auth.router import router as auth_router


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    # Production safety guard — see CLAUDE.md §7.
    if settings.is_prod and settings.dev_auth_bypass:
        raise RuntimeError(
            "DEV_AUTH_BYPASS=true in prod environment. Refusing to start."
        )
    yield


app = FastAPI(title="Malika v2", lifespan=lifespan)
app.include_router(auth_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
