"""计算并持久化全量岗位性价比综合分 value_score(0-100)。

报录比 + 招录数 + 进面分 全局归一化加权(权重同 tools.rank_by_value);
报录比 / 进面分 ≤0 视为缺数据,给中性 0.5。供看板 KPI 与性价比散点使用。

用法(Postgres 已起 + 已 ingest_jobs):
    uv run --directory backend python -m app.scripts.compute_value
"""

import asyncio

from sqlalchemy import select, text

from app.db.models import Job
from app.db.session import SessionLocal, engine

WEIGHTS = {"ratio": 0.5, "head": 0.3, "score": 0.2}


def _norm(x: float | None, lo: float, hi: float, *, invert: bool) -> float:
    if x is None or hi <= lo:
        return 0.5
    n = min(1.0, max(0.0, (x - lo) / (hi - lo)))
    return 1 - n if invert else n


async def main() -> None:
    async with SessionLocal() as db:
        rows = (
            await db.execute(select(Job.id, Job.apply_ratio, Job.headcount, Job.interview_score))
        ).all()

        ratios = [float(r.apply_ratio) for r in rows if r.apply_ratio and r.apply_ratio > 0]
        heads = [r.headcount for r in rows if r.headcount is not None]
        scores = [float(r.interview_score) for r in rows if r.interview_score and r.interview_score > 0]
        rlo, rhi = min(ratios), max(ratios)
        hlo, hhi = min(heads), max(heads)
        slo, shi = min(scores), max(scores)

        params = []
        for r in rows:
            ar = float(r.apply_ratio) if r.apply_ratio and r.apply_ratio > 0 else None
            sc = float(r.interview_score) if r.interview_score and r.interview_score > 0 else None
            value = 100 * (
                WEIGHTS["ratio"] * _norm(ar, rlo, rhi, invert=True)
                + WEIGHTS["head"] * _norm(r.headcount, hlo, hhi, invert=False)
                + WEIGHTS["score"] * _norm(sc, slo, shi, invert=True)
            )
            params.append({"jid": r.id, "v": round(value, 1)})

        await db.execute(text("UPDATE jobs SET value_score = :v WHERE id = :jid"), params)
        await db.commit()
    await engine.dispose()
    print(f"[OK] value_score 已更新 {len(params)} 行")


if __name__ == "__main__":
    asyncio.run(main())
