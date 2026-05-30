"""自研轻量 GraphRAG(PLAN §8.1,最大亮点)。

向量召回解决"语义相似",反向链接图扩展解决"关联完整":答某面试方法论时,
自动带出它关联的考点/概念。因知识库本就是带反向链接的图谱,省掉了微软 GraphRAG 的 LLM 抽取步骤。
"""

from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.embedding import embed_one, has_embed_key
from app.core.llm import has_llm_key, resolve_model, stream_completion
from app.core.prompts_store import COACH_PROMPT_NAME, system_prompt
from app.db.session import SessionLocal

COACH_SYSTEM_PROMPT = """你是公考面试教练。依据下方"检索到的知识库"作答
(知识库由自研 GraphRAG 提供:向量召回 + 反向链接图扩展)。要求:
- 主要基于检索到的 stance(主张)/ concept(方法)作答,自然地引用其标题;
- 给出可操作的面试建议(框架、话术、示例);
- 知识库未覆盖处可用常识补充,但不要编造具体"方法论名称"。"""


async def graph_rag_retrieve(db: AsyncSession, query: str, k: int = 5) -> list[dict]:
    """① bge-m3 向量召回种子节点 ② 沿反向链接图扩展 1 跳 ③ 组装(种子高权重 + 邻居补充)。"""
    q_emb = await embed_one(query)
    q_str = "[" + ",".join(map(str, q_emb)) + "]"

    seeds = (
        await db.execute(
            text(
                "SELECT node_id, embedding <=> CAST(:q AS vector) AS dist "
                "FROM kb_embeddings ORDER BY dist LIMIT :k"
            ),
            {"q": q_str, "k": k},
        )
    ).fetchall()
    if not seeds:
        return []
    seed_ids = [r.node_id for r in seeds]
    sim = {r.node_id: round(1 - float(r.dist), 3) for r in seeds}  # 余弦相似度 ≈ 1 - 距离

    neighbors = (
        await db.execute(
            text(
                "SELECT DISTINCT dst AS nid FROM kb_edges WHERE src = ANY(:ids) "
                "UNION SELECT DISTINCT src AS nid FROM kb_edges WHERE dst = ANY(:ids)"
            ),
            {"ids": seed_ids},
        )
    ).fetchall()
    neighbor_ids = [r.nid for r in neighbors if r.nid not in sim]

    all_ids = seed_ids + neighbor_ids
    rows = (
        await db.execute(
            text("SELECT id, type, title, body FROM kb_nodes WHERE id = ANY(:ids)"),
            {"ids": all_ids},
        )
    ).fetchall()
    by_id = {r.id: r for r in rows}

    out: list[dict] = []
    for nid in all_ids:  # 保持"种子在前、邻居在后"的图距离顺序
        r = by_id.get(nid)
        if r is None:
            continue
        out.append(
            {
                "id": r.id,
                "type": r.type,
                "title": r.title,
                "body": r.body,
                "is_seed": nid in sim,
                "score": sim.get(nid),
            }
        )
    return out


async def coach_stream(
    messages: list[dict], model: str = "auto", k: int = 5
) -> AsyncGenerator[dict, None]:
    if not has_llm_key():
        yield {"type": "text-delta", "delta": "(stub:未配置 DeepSeek key,面试教练不可用。)"}
        yield {"type": "finish", "model": "stub", "usage": None}
        return

    query = next((m["content"] for m in reversed(messages) if m.get("role") == "user"), "")
    k = max(3, min(k, 10))  # 检索深度兜底范围

    nodes: list[dict] = []
    if has_embed_key() and query:
        async with SessionLocal() as db:
            nodes = await graph_rag_retrieve(db, query, k=k)

    # 先把命中的知识来源发给前端(可视化检索引用 + 原文片段,体现 RAG 可解释)
    yield {
        "type": "sources",
        "items": [
            {
                "id": n["id"],
                "title": n["title"],
                "type": n["type"],
                "is_seed": n["is_seed"],
                "score": n["score"],
                "snippet": " ".join((n["body"] or "").split())[:160],
            }
            for n in nodes
        ],
    }

    context = "\n\n".join(
        f"【{'主张' if n['type'] == 'stance' else '方法'}】{n['title']}\n{n['body'][:700]}"
        for n in nodes[:8]
    )
    base = await system_prompt(COACH_PROMPT_NAME, COACH_SYSTEM_PROMPT)
    system = base + (f"\n\n# 检索到的知识库\n{context}" if context else "")
    convo = [{"role": "system", "content": system}, *messages]

    async for event in stream_completion(resolve_model(model, messages), convo):
        yield event
