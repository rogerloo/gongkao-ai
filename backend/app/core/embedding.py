from openai import AsyncOpenAI

from app.core.config import settings

# bge-m3 via SiliconFlow(OpenAI 兼容 /v1/embeddings),免费,1024 维
SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1"
EMBED_MODEL = "BAAI/bge-m3"


def has_embed_key() -> bool:
    return bool(settings.siliconflow_api_key)


def _client() -> AsyncOpenAI:
    return AsyncOpenAI(api_key=settings.siliconflow_api_key, base_url=SILICONFLOW_BASE_URL)


async def embed_texts(texts: list[str], batch_size: int = 32) -> list[list[float]]:
    """批量 embedding;按 batch 切分避免单请求过大。"""
    client = _client()
    out: list[list[float]] = []
    for i in range(0, len(texts), batch_size):
        resp = await client.embeddings.create(model=EMBED_MODEL, input=texts[i : i + batch_size])
        out.extend(d.embedding for d in resp.data)
    return out


async def embed_one(text: str) -> list[float]:
    return (await embed_texts([text]))[0]
