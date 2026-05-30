"""token 用量记录(单点:SSE 出口在 finish 事件调用)。"""

from app.db.models import TokenUsage
from app.db.session import SessionLocal


async def record_usage(model: str, usage: dict, endpoint: str, latency_ms: int = 0) -> None:
    async with SessionLocal() as db:
        db.add(
            TokenUsage(
                model=model,
                endpoint=endpoint,
                prompt_tokens=int(usage.get("prompt_tokens", 0) or 0),
                completion_tokens=int(usage.get("completion_tokens", 0) or 0),
                total_tokens=int(usage.get("total_tokens", 0) or 0),
                latency_ms=int(latency_ms or 0),
            )
        )
        await db.commit()
