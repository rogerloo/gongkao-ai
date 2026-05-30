"""岗位数据入库(PLAN §6)。

源数据为脱敏公开 JSON({"meta":..., "rows":[...]}),全量不入 git,运行时按路径读取。
用法(Postgres 已起):
    uv run --directory backend python -m app.scripts.ingest_jobs [data.public.json 路径]
"""

import asyncio
import json
import sys
from pathlib import Path

from sqlalchemy import delete, func, insert, select

from app.db.models import Job
from app.db.session import SessionLocal, engine

DEFAULT_PATH = "data/jobs.public.json"  # 默认相对路径;实际路径用命令行参数传入


def _clean(v: object) -> str | None:
    if not isinstance(v, str):
        return None
    s = " ".join(v.split())  # 折叠换行/多空白(如 "黔西南州\n公安局")
    return s or None


def _num(v: object) -> float | None:
    return float(v) if isinstance(v, int | float) else None


def _int(v: object) -> int | None:
    return int(v) if isinstance(v, int) else None


def map_row(r: dict) -> dict:
    """中文源字段 → jobs 结构化列;原始行整体存入 raw(JSONB)。"""
    return {
        "province": _clean(r.get("省份")),
        "city": _clean(r.get("规范地市")),
        "year": _int(r.get("招考年份")),
        "unit": _clean(r.get("单位名称")),
        "position": _clean(r.get("职位名称")),
        "education": _clean(r.get("学历要求")),
        "major": _clean(r.get("专业要求")),
        "apply_ratio": _num(r.get("报录比")),  # 报录比
        "interview_score": _num(r.get("平均进面分数")),  # 进面分
        "headcount": _int(r.get("招录人数")),  # 招录数
        "value_score": None,  # 性价比综合分由算法计算(#11)
        "raw": r,
    }


async def ingest(path: str) -> None:
    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    rows = payload["rows"] if isinstance(payload, dict) else payload
    print(f"读取 {len(rows)} 行,开始入库 ...")

    mapped = [map_row(r) for r in rows]
    async with SessionLocal() as session:
        await session.execute(delete(Job))  # 幂等:清空重灌
        for i in range(0, len(mapped), 2000):
            await session.execute(insert(Job), mapped[i : i + 2000])
        await session.commit()
        total = await session.scalar(select(func.count()).select_from(Job))
        provinces = await session.scalar(select(func.count(func.distinct(Job.province))))
    await engine.dispose()
    print(f"[OK] 入库完成:jobs = {total} 行,省份 {provinces} 个")


if __name__ == "__main__":
    p = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PATH
    asyncio.run(ingest(p))
