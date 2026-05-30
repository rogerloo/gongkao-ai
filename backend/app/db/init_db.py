"""初始化数据库:启用 pgvector 扩展 + 建表 + hnsw 索引。

用法(Postgres 已起):
    uv run --directory backend python -m app.db.init_db
"""

import asyncio

from sqlalchemy import text

from app.db import models  # noqa: F401  注册模型到 Base.metadata
from app.db.base import Base
from app.db.session import engine


async def init_db() -> None:
    async with engine.begin() as conn:
        # 先建扩展,Vector 列类型与 hnsw 索引依赖它
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        await conn.run_sync(Base.metadata.create_all)
        # 轻量演进:create_all 不改已存在表,补加新列(幂等)
        await conn.execute(
            text("ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS latency_ms integer DEFAULT 0")
        )
    await engine.dispose()
    print("[OK] DB 初始化完成:pgvector 扩展 + 全部表 + hnsw 索引")


if __name__ == "__main__":
    asyncio.run(init_db())
