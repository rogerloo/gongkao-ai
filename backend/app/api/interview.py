"""面试模拟评分(PLAN §8 延伸):考生作答 → 依知识库 rubric 结构化打分 + 点评。

设计:GraphRAG 召回相关主张/方法作为评分依据 → LLM(JSON 模式)按 5 维打分 → 结构化返回。
强制走 deepseek-chat(reasoner 不支持 response_format)。
"""

import json
import time

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.embedding import has_embed_key
from app.core.graphrag import graph_rag_retrieve
from app.core.llm import CHAT_MODEL, client, has_llm_key
from app.core.usage import record_usage
from app.db.session import SessionLocal

router = APIRouter(prefix="/interview", tags=["interview"])

SCORE_SYSTEM = """你是公考面试考官,依据"评分知识库"为考生作答打分。
维度(各 0-20 分,总分 0-100):
1. 政治站位:是否升维到政治高度 / 基层治理 / 以人民为中心
2. 分析深度:是否多维度、有辩证、不停留表面
3. 结构条理:是否框架清晰、层次分明
4. 内容素材:是否有具体案例 / 数据 / 省情素材支撑
5. 语言表达:是否流畅、有感染力、口语化得当
只依据考生实际作答打分,严禁脑补其没说的内容;分数要有区分度。
严格以 JSON 输出(不要多余文字),字段:
- total:总分 int(0-100)
- dimensions:数组,每项含 name(维度名)、score(0-20 int)、comment(简短点评)
- summary:一句话总评
- suggestions:字符串数组,3 条以内可操作的提分建议"""


class ScoreReq(BaseModel):
    question: str
    answer: str


def _safe_json(text: str) -> dict:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass
    return {"total": 0, "dimensions": [], "summary": "评分解析失败,请重试", "suggestions": []}


@router.post("/score")
async def score(req: ScoreReq) -> dict:
    if not has_llm_key():
        return {"total": 0, "dimensions": [], "summary": "(未配置 DeepSeek key)", "suggestions": [], "sources": []}

    # GraphRAG 召回评分依据
    nodes: list[dict] = []
    if has_embed_key() and req.question:
        async with SessionLocal() as db:
            nodes = await graph_rag_retrieve(db, f"{req.question} {req.answer}", k=5)
    context = "\n\n".join(
        f"【{'主张' if n['type'] == 'stance' else '方法'}】{n['title']}\n{n['body'][:500]}"
        for n in nodes[:6]
    )
    system = SCORE_SYSTEM + (f"\n\n# 评分知识库\n{context}" if context else "")

    start = time.perf_counter()
    resp = await client().chat.completions.create(
        model=CHAT_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": f"面试题:{req.question}\n\n考生作答:{req.answer}"},
        ],
        response_format={"type": "json_object"},
    )
    latency_ms = int((time.perf_counter() - start) * 1000)
    data = _safe_json(resp.choices[0].message.content or "{}")
    if resp.usage:
        await record_usage(CHAT_MODEL, resp.usage.model_dump(), "interview", latency_ms)

    # 兜底:维度分钳到 0-20、总分钳到 0-100(模型偶尔越界)
    dims = []
    for d in data.get("dimensions", []):
        try:
            s = max(0, min(int(d.get("score", 0)), 20))
        except (TypeError, ValueError):
            s = 0
        dims.append({"name": str(d.get("name", "")), "score": s, "comment": str(d.get("comment", ""))})

    try:
        total = max(0, min(int(data.get("total", 0) or 0), 100))
    except (TypeError, ValueError):
        total = sum(d["score"] for d in dims)

    return {
        "total": total,
        "dimensions": dims,
        "summary": data.get("summary", ""),
        "suggestions": data.get("suggestions", []),
        "sources": [n["title"] for n in nodes],
        "model": CHAT_MODEL,
    }
