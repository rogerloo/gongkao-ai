"""灌入初始 Prompt 模板(选岗 / 面试教练 / 通用含变量示例)。

用法: uv run --directory backend python -m app.scripts.seed_prompts
"""

import asyncio
import re

from sqlalchemy import delete

from app.core.agent import AGENT_SYSTEM_PROMPT
from app.core.graphrag import COACH_SYSTEM_PROMPT
from app.db.models import Prompt, PromptVersion
from app.db.session import SessionLocal, engine

VAR_RE = re.compile(r"\{\{\s*(\w+)\s*\}\}")

SEEDS: list[tuple[str, str]] = [
    ("选岗 Agent 系统提示", AGENT_SYSTEM_PROMPT),
    ("面试教练系统提示", COACH_SYSTEM_PROMPT),
    (
        "通用助手(含变量示例)",
        "你是一名{{role}},请用{{tone}}的语气,面向{{audience}},回答关于「{{topic}}」的问题。",
    ),
]


async def main() -> None:
    async with SessionLocal() as db:
        await db.execute(delete(PromptVersion))
        await db.execute(delete(Prompt))
        for name, sp in SEEDS:
            p = Prompt(name=name, current_version=1)
            db.add(p)
            await db.flush()
            db.add(
                PromptVersion(
                    prompt_id=p.id,
                    version=1,
                    system_prompt=sp,
                    variables=sorted(set(VAR_RE.findall(sp))),
                )
            )
        await db.commit()
    await engine.dispose()
    print(f"[OK] 灌入 {len(SEEDS)} 套 Prompt 模板")


if __name__ == "__main__":
    asyncio.run(main())
