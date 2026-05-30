"""知识图谱入库(PLAN §6 / §8.1)。

解析 wiki 的 stance/concept Markdown:frontmatter + 正则抽 [[反向链接]] 建邻接表,
正文过 bge-m3(SiliconFlow)生成向量入 kb_embeddings。仅保留两端都是已入库节点的边(满足 FK)。

用法(Postgres 已起 + SILICONFLOW_API_KEY 已配):
    uv run --directory backend python -m app.scripts.ingest_kb [知识图谱 md 目录]
"""

import asyncio
import json
import re
import sys
from pathlib import Path

import yaml
from sqlalchemy import delete, text

from app.core.embedding import embed_texts, has_embed_key
from app.db.models import KbEdge, KbEmbedding, KbNode
from app.db.session import SessionLocal, engine

DEFAULT_DIR = "data/kb"  # 默认相对路径;实际的 stance/concept md 目录用命令行参数传入
SUBDIRS = [("stances", "stance"), ("concepts", "concept")]
LINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def parse_md(text: str) -> tuple[dict, str]:
    """拆分 YAML frontmatter 与正文。"""
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            try:
                fm = yaml.safe_load(text[3:end]) or {}
            except yaml.YAMLError:
                fm = {}
            return fm, text[end + 4 :].strip()
    return {}, text.strip()


def extract_links(text: str) -> set[str]:
    """抽取所有 [[目标]](去掉 |别名 与 #小节)。"""
    out: set[str] = set()
    for raw in LINK_RE.findall(text):
        target = raw.split("|")[0].split("#")[0].strip()
        if target:
            out.add(target)
    return out


def _json_safe(obj: object) -> object:
    """frontmatter 含 date 等非 JSON 类型,统一转字符串以入 JSONB。"""
    return json.loads(json.dumps(obj, default=str, ensure_ascii=False))


def read_text_smart(path: Path) -> str:
    """容错读取混合编码的 wiki 文件(UTF-8 / UTF-8-BOM / UTF-16 / GBK),并剥离 NULL 字节。"""
    data = path.read_bytes()
    if data[:2] in (b"\xff\xfe", b"\xfe\xff"):
        text = data.decode("utf-16", errors="replace")
    elif data[:3] == b"\xef\xbb\xbf":
        text = data.decode("utf-8-sig", errors="replace")
    else:
        text = None
        for enc in ("utf-8", "gb18030"):
            try:
                text = data.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        if text is None:
            text = data.decode("utf-8", errors="replace")
    return text.replace("\x00", "")  # Postgres text/jsonb 不允许 NULL 字节


async def ingest(geo_dir: str) -> None:
    if not has_embed_key():
        print("[ERR] 未配置 SILICONFLOW_API_KEY,无法生成向量")
        return

    files = [(p, typ) for sub, typ in SUBDIRS for p in sorted(Path(geo_dir, sub).glob("*.md"))]
    ids = {p.stem for p, _ in files}

    nodes: list[dict] = []
    edges: set[tuple[str, str]] = set()
    for path, typ in files:
        raw = read_text_smart(path)
        fm, body = parse_md(raw)
        nid = path.stem
        title = nid.split(" - ", 1)[-1] if " - " in nid else nid
        nodes.append(
            {
                "id": nid,
                "type": str(fm.get("type") or typ),
                "title": title,
                "body": body,
                "meta": _json_safe(fm),
            }
        )
        for link in extract_links(raw):
            if link in ids and link != nid:
                edges.add((nid, link))

    print(f"解析 {len(nodes)} 节点 / {len(edges)} 条边,调用 bge-m3 生成向量 ...")
    vectors = await embed_texts([f"{n['title']}\n\n{n['body'][:1500]}" for n in nodes])

    async with SessionLocal() as db:
        await db.execute(delete(KbEdge))
        await db.execute(delete(KbEmbedding))
        await db.execute(delete(KbNode))
        db.add_all(
            KbNode(id=n["id"], type=n["type"], title=n["title"], body=n["body"], meta=n["meta"])
            for n in nodes
        )
        await db.flush()
        db.add_all(KbEdge(src=s, dst=d, rel="related_to") for s, d in edges)
        await db.flush()
        # 向量:原生 SQL + CAST,避免编解码冲突
        emb_rows = [
            {"nid": n["id"], "emb": "[" + ",".join(map(str, v)) + "]"}
            for n, v in zip(nodes, vectors, strict=True)
        ]
        await db.execute(
            text("INSERT INTO kb_embeddings (node_id, embedding) VALUES (:nid, CAST(:emb AS vector))"),
            emb_rows,
        )
        await db.commit()
    await engine.dispose()
    print(f"[OK] kb_nodes={len(nodes)} kb_edges={len(edges)} kb_embeddings={len(vectors)}")


if __name__ == "__main__":
    d = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_DIR
    asyncio.run(ingest(d))
