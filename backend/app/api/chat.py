import json
import time
from collections.abc import AsyncGenerator, AsyncIterator

from fastapi import APIRouter
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from app.core.agent import agent_stream
from app.core.graphrag import coach_stream
from app.core.llm import MODEL_CATALOG, stream_chat
from app.core.prompts_store import AGENT_PROMPT_NAME, COACH_PROMPT_NAME, active_prompt
from app.core.usage import record_usage

router = APIRouter(prefix="/chat", tags=["chat"])


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[Message]
    task: str = "simple"  # simple | complex(路由到 reasoner)
    model: str = "auto"  # auto | deepseek-chat | deepseek-reasoner
    k: int = 5  # 面试教练 GraphRAG 检索深度(种子数)


def _sse(events: AsyncIterator[dict], endpoint: str) -> EventSourceResponse:
    """把事件异步迭代器包成 SSE;在 finish 事件单点记录真实 token 用量。"""

    async def gen() -> AsyncGenerator[dict, None]:
        start = time.perf_counter()
        async for event in events:
            if (
                event.get("type") == "finish"
                and event.get("usage")
                and "stub" not in (event.get("model") or "")
            ):
                latency_ms = int((time.perf_counter() - start) * 1000)
                await record_usage(str(event.get("model")), event["usage"], endpoint, latency_ms)
            yield {"data": json.dumps(event, ensure_ascii=False)}
        yield {"data": "[DONE]"}

    return EventSourceResponse(gen())


@router.get("/models")
async def chat_models() -> list[dict[str, str]]:
    """可用模型目录(前端模型选择器的单一数据源)。"""
    return MODEL_CATALOG


@router.get("/active-prompts")
async def chat_active_prompts() -> dict:
    """各模式当前生效的 Prompt(名称+版本),体现「配置中心改了即时生效」闭环。"""
    out: dict[str, dict] = {}
    for mode, name in (("agent", AGENT_PROMPT_NAME), ("coach", COACH_PROMPT_NAME)):
        p = await active_prompt(name)
        out[mode] = {"name": name, "version": p["version"] if p else None}
    return out


@router.post("/stream")
async def chat_stream(req: ChatRequest) -> EventSourceResponse:
    """普通流式对话(PLAN §8.3);支持 auto/chat/reasoner 模型选择。"""
    return _sse(
        stream_chat([m.model_dump() for m in req.messages], req.task, req.model), "chat"
    )


@router.post("/agent")
async def chat_agent(req: ChatRequest) -> EventSourceResponse:
    """选岗 Agent:Function Calling 调真实岗位算法(PLAN §8.2)。固定 chat 模型(reasoner 不支持工具)。"""
    return _sse(agent_stream([m.model_dump() for m in req.messages]), "agent")


@router.post("/coach")
async def chat_coach(req: ChatRequest) -> EventSourceResponse:
    """面试教练:自研 GraphRAG 检索 + 流式答(PLAN §8.1);支持模型选择与检索深度。"""
    return _sse(coach_stream([m.model_dump() for m in req.messages], req.model, req.k), "coach")
