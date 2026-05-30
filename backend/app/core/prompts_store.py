"""运行期读取 Prompt 配置中心的「当前版本」系统提示(闭环:配置即生效,PLAN §7)。

约定:对话三模式各对应一条具名 Prompt(种子见 seed_prompts.py)。
找不到或为空时回退到代码内置常量,保证健壮。
"""

from sqlalchemy import text

from app.db.session import SessionLocal

# 模式 → Prompt 名(与 seed_prompts.py 对齐)
AGENT_PROMPT_NAME = "选岗 Agent 系统提示"
COACH_PROMPT_NAME = "面试教练系统提示"

_ACTIVE_SQL = text(
    "SELECT pv.system_prompt, pv.version FROM prompts p "
    "JOIN prompt_versions pv ON pv.prompt_id = p.id AND pv.version = p.current_version "
    "WHERE p.name = :name"
)


async def active_prompt(name: str) -> dict | None:
    """取某具名 Prompt 的当前版本:{system_prompt, version},无则 None。"""
    async with SessionLocal() as db:
        row = (await db.execute(_ACTIVE_SQL, {"name": name})).first()
    if not row or not row[0]:
        return None
    return {"system_prompt": row[0], "version": row[1]}


async def system_prompt(name: str, fallback: str) -> str:
    """取当前版本系统提示;缺失则回退内置常量。"""
    p = await active_prompt(name)
    return p["system_prompt"] if p else fallback
