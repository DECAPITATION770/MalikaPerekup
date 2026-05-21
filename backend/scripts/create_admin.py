"""One-shot script to create a platform admin with login + password.

Usage:
    cd backend
    uv run python scripts/create_admin.py
"""

import asyncio
import getpass
import sys

sys.path.insert(0, '.')

from app.core.config import get_settings
from app.core.database import async_session_factory
from app.core.security import hash_password
from app.features.admin.models import PlatformAdmin
from sqlalchemy import select


async def main() -> None:
    print("=== Malika Admin — Create platform admin ===\n")

    full_name = input("Full name: ").strip()
    login = input("Login: ").strip()
    password = getpass.getpass("Password (min 8 chars): ")

    if len(login) < 3:
        print("Login must be at least 3 characters.")
        sys.exit(1)
    if len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)

    async with async_session_factory() as db:
        existing = (await db.execute(
            select(PlatformAdmin).where(PlatformAdmin.login == login)
        )).scalar_one_or_none()

        if existing:
            print(f"Admin with login '{login}' already exists (id={existing.id}).")
            sys.exit(1)

        admin = PlatformAdmin(
            full_name=full_name,
            login=login,
            password_hash=hash_password(password),
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)
        print(f"\nAdmin created! id={admin.id}, login='{login}'")


if __name__ == "__main__":
    asyncio.run(main())
