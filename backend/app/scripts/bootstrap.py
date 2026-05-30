"""一键初始化:建表 + 种子用户 + 种子 Prompt。

裸库执行后即可登录并使用对话/Prompt 中心(岗位与知识库数据需另跑 ingest_jobs / ingest_kb)。

运行:
    uv run python -m app.scripts.bootstrap
"""

import asyncio

from app.db.init_db import init_db
from app.scripts.seed_prompts import main as seed_prompts
from app.scripts.seed_users import main as seed_users


async def main() -> None:
    await init_db()
    await seed_users()
    await seed_prompts()
    print("[OK] bootstrap 完成:schema + 用户 + Prompt 就绪")
    print("    下一步(可选):uv run python -m app.scripts.ingest_jobs / ingest_kb 灌入业务数据")


if __name__ == "__main__":
    asyncio.run(main())
