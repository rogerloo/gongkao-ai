"""种子用户(四级 RBAC 演示账号)。幂等。

运行:uv run python -m app.scripts.seed_users
"""

import asyncio

from sqlalchemy import select

from app.core.security import hash_password
from app.db.models import User
from app.db.session import SessionLocal

# (用户名, 密码, 角色);密码 = 用户名 + 123
USERS = [
    ("admin", "admin123", "admin"),
    ("editor", "editor123", "editor"),
    ("analyst", "analyst123", "analyst"),
    ("viewer", "viewer123", "viewer"),
]


async def main() -> None:
    async with SessionLocal() as db:
        for username, pw, role in USERS:
            existing = (
                await db.execute(select(User).where(User.username == username))
            ).scalar_one_or_none()
            if existing:
                existing.pwd_hash = hash_password(pw)
                existing.role = role
            else:
                db.add(User(username=username, pwd_hash=hash_password(pw), role=role))
        await db.commit()
    print(f"[OK] seeded {len(USERS)} users: {', '.join(u[0] for u in USERS)}")


if __name__ == "__main__":
    asyncio.run(main())
