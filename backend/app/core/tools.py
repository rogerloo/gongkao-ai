"""选岗 Agent 的 Function Calling 工具(PLAN §8.2)。

设计范式:LLM 做意图理解,确定性的性价比算法用代码精确计算 —— 而非让 LLM 拍脑袋算分。
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Job

# OpenAI 兼容 Function Calling schema
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "filter_jobs",
            "description": "按条件筛选公考岗位,返回匹配岗位列表(含报录比/进面分/招录数)。",
            "parameters": {
                "type": "object",
                "properties": {
                    "province": {"type": "string", "description": "省份,如 贵州 / 青海"},
                    "city": {"type": "string", "description": "地市,如 贵阳 / 西宁"},
                    "year": {"type": "integer", "description": "招考年份,如 2023"},
                    "education": {
                        "type": "string",
                        "description": "学历要求关键词,如 本科 / 大专 / 研究生",
                    },
                    "major": {"type": "string", "description": "专业关键词,如 计算机 / 法学"},
                    "min_headcount": {"type": "integer", "description": "最低招录人数"},
                    "max_apply_ratio": {"type": "number", "description": "最高报录比(竞争上限)"},
                    "limit": {"type": "integer", "description": "返回条数上限,默认 20,最大 50"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "rank_by_value",
            "description": "对一组岗位按性价比综合分排序(报录比+招录数+进面分加权),返回带分数结果。",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "要排序的岗位 id 列表(通常来自 filter_jobs 的返回)",
                    }
                },
                "required": ["job_ids"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_jobs",
            "description": "对 2-5 个岗位逐维度对比(报录比/招录数/进面分/性价比),并标出各维度最优岗位。",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_ids": {
                        "type": "array",
                        "items": {"type": "integer"},
                        "description": "要对比的岗位 id 列表(建议 2-5 个)",
                    }
                },
                "required": ["job_ids"],
            },
        },
    },
]

# 性价比权重:竞争(报录比)为主,机会(招录数)次之,门槛(进面分)再次
VALUE_WEIGHTS = {"ratio": 0.5, "head": 0.3, "score": 0.2}


def _brief(j: Job) -> dict:
    return {
        "id": j.id,
        "province": j.province,
        "city": j.city,
        "year": j.year,
        "unit": j.unit,
        "position": j.position,
        "education": j.education,
        "apply_ratio": float(j.apply_ratio) if j.apply_ratio is not None else None,
        "interview_score": float(j.interview_score) if j.interview_score is not None else None,
        "headcount": j.headcount,
    }


async def filter_jobs(
    db: AsyncSession,
    *,
    province: str | None = None,
    city: str | None = None,
    year: int | None = None,
    education: str | None = None,
    major: str | None = None,
    min_headcount: int | None = None,
    max_apply_ratio: float | None = None,
    limit: int | None = 20,
    **_extra: object,
) -> dict:
    stmt = select(Job)
    if province:
        stmt = stmt.where(Job.province.ilike(f"%{province}%"))
    if city:
        stmt = stmt.where(Job.city.ilike(f"%{city}%"))
    if year:
        stmt = stmt.where(Job.year == year)
    if education:
        stmt = stmt.where(Job.education.ilike(f"%{education}%"))
    if major:
        stmt = stmt.where(Job.major.ilike(f"%{major}%"))
    if min_headcount:
        stmt = stmt.where(Job.headcount >= min_headcount)
    if max_apply_ratio:
        stmt = stmt.where(Job.apply_ratio <= max_apply_ratio)

    stmt = stmt.order_by(Job.headcount.desc().nulls_last()).limit(min(limit or 20, 50))
    rows = (await db.execute(stmt)).scalars().all()
    jobs = [_brief(j) for j in rows]
    return {"summary": f"匹配岗位返回 {len(jobs)} 个", "data": {"jobs": jobs}}


def _norm(x: float | None, arr: list[float], *, invert: bool) -> float:
    """归一化到 0-1;集合无区分度或缺值时给中性 0.5。"""
    if x is None or not arr or max(arr) == min(arr):
        return 0.5
    n = (x - min(arr)) / (max(arr) - min(arr))
    return 1 - n if invert else n


async def rank_by_value(db: AsyncSession, *, job_ids: list[int], **_extra: object) -> dict:
    rows = (await db.execute(select(Job).where(Job.id.in_(job_ids)))).scalars().all()
    items = [_brief(j) for j in rows]

    # 报录比 ≤0 视为缺报名数据(本数据集 0 多为缺值),不计入归一化、按中性处理
    ratios = [i["apply_ratio"] for i in items if i["apply_ratio"] and i["apply_ratio"] > 0]
    heads = [i["headcount"] for i in items if i["headcount"] is not None]
    scores = [i["interview_score"] for i in items if i["interview_score"] is not None]

    for i in items:
        ar = i["apply_ratio"] if (i["apply_ratio"] and i["apply_ratio"] > 0) else None
        r = _norm(ar, ratios, invert=True)  # 报录比越低越好(0/缺值按中性)
        h = _norm(i["headcount"], heads, invert=False)  # 招录数越多越好
        s = _norm(i["interview_score"], scores, invert=True)  # 进面分越低越易
        i["value_score"] = round(
            100 * (VALUE_WEIGHTS["ratio"] * r + VALUE_WEIGHTS["head"] * h + VALUE_WEIGHTS["score"] * s),
            1,
        )

    items.sort(key=lambda i: i["value_score"], reverse=True)
    return {"summary": f"已按性价比排序 {len(items)} 个岗位", "data": {"ranked": items}}


async def compare_jobs(db: AsyncSession, *, job_ids: list[int], **_extra: object) -> dict:
    rows = (await db.execute(select(Job).where(Job.id.in_(job_ids)))).scalars().all()
    items = [
        {**_brief(j), "value_score": float(j.value_score) if j.value_score is not None else None}
        for j in rows
    ]

    def best(key: str, *, lowest: bool) -> dict | None:
        cand = [i for i in items if i.get(key) is not None]
        if not cand:
            return None
        chosen = (min if lowest else max)(cand, key=lambda i: i[key])
        return {"id": chosen["id"], "unit": chosen["unit"], key: chosen[key]}

    winners = {
        "lowest_apply_ratio": best("apply_ratio", lowest=True),
        "most_headcount": best("headcount", lowest=False),
        "lowest_interview_score": best("interview_score", lowest=True),
        "highest_value_score": best("value_score", lowest=False),
    }
    hl = []
    if winners["lowest_apply_ratio"]:
        hl.append(f"报录比最低:{winners['lowest_apply_ratio']['unit']}")
    if winners["highest_value_score"]:
        hl.append(f"性价比最高:{winners['highest_value_score']['unit']}")
    summary = f"已对比 {len(items)} 个岗位" + (f"({';'.join(hl)})" if hl else "")
    return {"summary": summary, "data": {"jobs": items, "winners": winners}}


async def execute_tool(name: str, args: dict, db: AsyncSession) -> dict:
    if name == "filter_jobs":
        return await filter_jobs(db, **args)
    if name == "rank_by_value":
        return await rank_by_value(db, **args)
    if name == "compare_jobs":
        return await compare_jobs(db, **args)
    return {"summary": f"未知工具 {name}", "data": {}}
