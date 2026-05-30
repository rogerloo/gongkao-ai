"""LLM token 成本看板聚合(PLAN §8.3)。"""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import TokenUsage
from app.db.session import get_session

router = APIRouter(prefix="/llm", tags=["llm"])


@router.get("/usage")
async def usage(db: AsyncSession = Depends(get_session)) -> dict:
    totals = (
        await db.execute(
            select(
                func.count(TokenUsage.id),
                func.coalesce(func.sum(TokenUsage.total_tokens), 0),
                func.coalesce(func.sum(TokenUsage.prompt_tokens), 0),
                func.coalesce(func.sum(TokenUsage.completion_tokens), 0),
                func.coalesce(func.avg(TokenUsage.latency_ms), 0),
            )
        )
    ).one()

    by_model = [
        {"model": r[0], "requests": r[1], "tokens": int(r[2] or 0)}
        for r in (
            await db.execute(
                select(TokenUsage.model, func.count(TokenUsage.id), func.sum(TokenUsage.total_tokens))
                .group_by(TokenUsage.model)
                .order_by(func.sum(TokenUsage.total_tokens).desc())
            )
        ).all()
    ]

    by_endpoint = [
        {"endpoint": r[0], "requests": r[1], "tokens": int(r[2] or 0)}
        for r in (
            await db.execute(
                select(
                    TokenUsage.endpoint, func.count(TokenUsage.id), func.sum(TokenUsage.total_tokens)
                ).group_by(TokenUsage.endpoint)
            )
        ).all()
    ]

    total_tokens = int(totals[1] or 0)
    return {
        "requests": totals[0],
        "total_tokens": total_tokens,
        "prompt_tokens": int(totals[2] or 0),
        "completion_tokens": int(totals[3] or 0),
        "avg_latency_ms": round(float(totals[4] or 0)),
        "est_cost_cny": round(total_tokens / 1_000_000 * 2, 4),  # 粗估混合 ¥2/百万 token
        "by_model": by_model,
        "by_endpoint": by_endpoint,
    }


@router.get("/usage/timeseries")
async def usage_timeseries(db: AsyncSession = Depends(get_session)) -> list[dict]:
    """最近调用的时序点(tokens 与延迟随时间),供趋势图。"""
    rows = (
        await db.execute(
            select(
                TokenUsage.created_at,
                TokenUsage.total_tokens,
                TokenUsage.latency_ms,
                TokenUsage.endpoint,
                TokenUsage.model,
            )
            .order_by(TokenUsage.created_at.desc())
            .limit(50)
        )
    ).all()
    # 反转为时间升序,便于前端按时间轴绘制
    return [
        {
            "t": r[0].isoformat() if r[0] else None,
            "tokens": int(r[1] or 0),
            "latency_ms": int(r[2] or 0),
            "endpoint": r[3],
            "model": r[4],
        }
        for r in reversed(rows)
    ]
