"""知识库管理(PLAN §9):节点列表 + Embedding 状态 + GraphRAG 检索测试。"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.graphrag import graph_rag_retrieve
from app.db.models import KbEdge, KbEmbedding, KbNode
from app.db.session import get_session

router = APIRouter(prefix="/kb", tags=["kb"])


@router.get("/nodes")
async def list_nodes(
    node_type: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_session),
) -> dict:
    embedded = set((await db.execute(select(KbEmbedding.node_id))).scalars().all())
    deg_rows = (await db.execute(select(KbEdge.src, func.count()).group_by(KbEdge.src))).all()
    degree = {r[0]: r[1] for r in deg_rows}

    stmt = select(KbNode)
    if node_type:
        stmt = stmt.where(KbNode.type == node_type)
    if q:
        stmt = stmt.where(KbNode.title.ilike(f"%{q}%"))
    nodes = (await db.execute(stmt.order_by(KbNode.type, KbNode.title))).scalars().all()

    return {
        "total": len(nodes),
        "stances": sum(1 for n in nodes if n.type == "stance"),
        "concepts": sum(1 for n in nodes if n.type == "concept"),
        "items": [
            {
                "id": n.id,
                "type": n.type,
                "title": n.title,
                "has_embedding": n.id in embedded,
                "degree": degree.get(n.id, 0),
            }
            for n in nodes
        ],
    }


@router.get("/graph")
async def graph(db: AsyncSession = Depends(get_session)) -> dict:
    """知识图谱全图(力导向可视化用):节点按 type 分类、按度数定大小,边带关系类型。"""
    nodes = (await db.execute(select(KbNode))).scalars().all()
    edges = (await db.execute(select(KbEdge))).scalars().all()
    deg: dict[str, int] = {}
    for e in edges:
        deg[e.src] = deg.get(e.src, 0) + 1
        deg[e.dst] = deg.get(e.dst, 0) + 1
    return {
        "nodes": [
            {"id": n.id, "title": n.title or n.id, "type": n.type, "degree": deg.get(n.id, 0)}
            for n in nodes
        ],
        "edges": [{"source": e.src, "target": e.dst, "rel": e.rel} for e in edges],
    }


@router.get("/node/{node_id}")
async def node_detail(node_id: str, db: AsyncSession = Depends(get_session)) -> dict:
    """单节点详情:正文 + 向量状态 + 邻居(供图谱点击查看)。"""
    node = await db.get(KbNode, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="节点不存在")
    has_emb = (
        await db.execute(select(KbEmbedding.node_id).where(KbEmbedding.node_id == node_id))
    ).first() is not None

    edges = (
        await db.execute(select(KbEdge).where(or_(KbEdge.src == node_id, KbEdge.dst == node_id)))
    ).scalars().all()
    nbr_ids = {(e.dst if e.src == node_id else e.src) for e in edges}
    nbr_rows = (
        (
            await db.execute(
                select(KbNode.id, KbNode.title, KbNode.type).where(KbNode.id.in_(nbr_ids))
            )
        ).all()
        if nbr_ids
        else []
    )
    nbr_map = {r[0]: {"id": r[0], "title": r[1], "type": r[2]} for r in nbr_rows}

    neighbors: list[dict] = []
    seen: set[str] = set()
    for e in edges:
        other = e.dst if e.src == node_id else e.src
        info = nbr_map.get(other)
        if other in seen or info is None:
            continue
        seen.add(other)
        neighbors.append({**info, "rel": e.rel})

    return {
        "id": node.id,
        "type": node.type,
        "title": node.title,
        "body": node.body,
        "has_embedding": has_emb,
        "neighbors": neighbors,
    }


class SearchReq(BaseModel):
    query: str
    k: int = 5


@router.post("/search")
async def search(body: SearchReq, db: AsyncSession = Depends(get_session)) -> dict:
    """GraphRAG 检索测试:返回种子(向量召回)+ 图扩展邻居。"""
    nodes = await graph_rag_retrieve(db, body.query, k=body.k)
    return {
        "items": [
            {
                "id": n["id"],
                "title": n["title"],
                "type": n["type"],
                "is_seed": n["is_seed"],
                "score": n["score"],
            }
            for n in nodes
        ]
    }
