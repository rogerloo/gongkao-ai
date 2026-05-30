from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)

SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

# 说明:向量的写入/查询统一用原生 SQL + CAST(:x AS vector),绕开 asyncpg 编解码与
# SQLAlchemy Vector 绑定的双重处理冲突。Vector 列类型仅用于建表(models.py)。


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI 依赖:每请求一个异步会话。"""
    async with SessionLocal() as session:
        yield session
