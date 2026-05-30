from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import ForeignKey, Index, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

# bge-m3 向量维度
EMBEDDING_DIM = 1024


class Job(Base):
    """公考岗位(结构化 + 性价比综合分)。"""

    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    province: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int | None] = mapped_column(Integer)
    unit: Mapped[str | None] = mapped_column(Text)
    position: Mapped[str | None] = mapped_column(Text)
    education: Mapped[str | None] = mapped_column(Text)
    major: Mapped[str | None] = mapped_column(Text)
    apply_ratio: Mapped[float | None] = mapped_column(Numeric)  # 报录比
    interview_score: Mapped[float | None] = mapped_column(Numeric)  # 进面分
    headcount: Mapped[int | None] = mapped_column(Integer)  # 招录数
    value_score: Mapped[float | None] = mapped_column(Numeric)  # 性价比综合分 0-100
    raw: Mapped[dict | None] = mapped_column(JSONB)

    __table_args__ = (Index("idx_jobs_filter", "province", "city", "year", "education"),)


class KbNode(Base):
    """知识图谱节点(stance / concept)。"""

    __tablename__ = "kb_nodes"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # 文件名 slug
    type: Mapped[str | None] = mapped_column(Text)  # stance | concept
    title: Mapped[str | None] = mapped_column(Text)
    body: Mapped[str | None] = mapped_column(Text)
    meta: Mapped[dict | None] = mapped_column(JSONB)  # frontmatter


class KbEdge(Base):
    """反向链接邻接表。"""

    __tablename__ = "kb_edges"

    src: Mapped[str] = mapped_column(Text, ForeignKey("kb_nodes.id"), primary_key=True)
    dst: Mapped[str] = mapped_column(Text, ForeignKey("kb_nodes.id"), primary_key=True)
    rel: Mapped[str] = mapped_column(Text, primary_key=True)  # used_by | related_to | lineage


class KbEmbedding(Base):
    """节点正文向量(bge-m3 = 1024 维)。"""

    __tablename__ = "kb_embeddings"

    node_id: Mapped[str] = mapped_column(Text, ForeignKey("kb_nodes.id"), primary_key=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBEDDING_DIM))

    __table_args__ = (
        Index(
            "idx_kb_embeddings_hnsw",
            "embedding",
            postgresql_using="hnsw",
            postgresql_ops={"embedding": "vector_cosine_ops"},
        ),
    )


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(Text)
    current_version: Mapped[int | None] = mapped_column(Integer)


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    prompt_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("prompts.id"))
    version: Mapped[int | None] = mapped_column(Integer)
    system_prompt: Mapped[str | None] = mapped_column(Text)
    variables: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(Text, unique=True)
    pwd_hash: Mapped[str | None] = mapped_column(Text)
    role: Mapped[str | None] = mapped_column(Text)  # admin | editor | analyst | viewer


class TokenUsage(Base):
    """LLM 调用 token 用量流水(成本看板,PLAN §8.3)。"""

    __tablename__ = "token_usage"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    model: Mapped[str | None] = mapped_column(Text)
    endpoint: Mapped[str | None] = mapped_column(Text)  # chat | agent | coach
    prompt_tokens: Mapped[int] = mapped_column(Integer, default=0)
    completion_tokens: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)  # 端到端流式时延
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())
