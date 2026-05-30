import asyncio
from collections.abc import AsyncGenerator

from app.core.config import settings

# DeepSeek 走 OpenAI 兼容协议(PLAN §3:SDK 直连,不套 LangChain)
DEEPSEEK_BASE_URL = "https://api.deepseek.com"

# 多模型(同一 DeepSeek key,无需额外密钥):V3 快速对话 / R1 深度推理(带思维链)
CHAT_MODEL = "deepseek-chat"
REASONER_MODEL = "deepseek-reasoner"
AVAILABLE_MODELS = (CHAT_MODEL, REASONER_MODEL)

# 前端模型选择器的目录(单一数据源,GET /chat/models 暴露)
MODEL_CATALOG: list[dict[str, str]] = [
    {"id": "auto", "label": "Auto 智能路由", "desc": "按问题复杂度自动选模型"},
    {"id": CHAT_MODEL, "label": "DeepSeek-V3 · 快速", "desc": "通用对话,低延迟"},
    {"id": REASONER_MODEL, "label": "DeepSeek-R1 · 深度推理", "desc": "展示思维链,擅长分析推理"},
]

# auto 路由启发式:命中分析/论证类关键词或长问题 → 走 reasoner
_REASONER_HINTS = (
    "为什么",
    "分析",
    "比较",
    "评价",
    "论证",
    "推理",
    "证明",
    "怎么看",
    "如何看待",
    "利弊",
    "权衡",
    "深入",
    "步骤",
)


def _last_user(messages: list[dict]) -> str:
    return next((m.get("content", "") for m in reversed(messages) if m.get("role") == "user"), "")


def resolve_model(model: str | None, messages: list[dict] | None = None, task: str = "simple") -> str:
    """把前端的 model 选择解析为真实模型名。

    - 显式 'deepseek-chat' / 'deepseek-reasoner':直接使用;
    - 'auto' / None / 未知:启发式——task=complex 或问题偏分析/较长 → reasoner,否则 chat。
    """
    if model in AVAILABLE_MODELS:
        return model  # 用户显式选择优先
    if task == "complex":
        return REASONER_MODEL
    last = _last_user(messages or [])
    if len(last) >= 60 or any(h in last for h in _REASONER_HINTS):
        return REASONER_MODEL
    return CHAT_MODEL


def route_model(task: str) -> str:
    """旧签名兼容(PLAN §8.3):复杂任务走 reasoner,其余走 chat。"""
    return REASONER_MODEL if task == "complex" else CHAT_MODEL


def has_llm_key() -> bool:
    return bool(settings.deepseek_api_key)


def client():
    """共享的 DeepSeek 异步客户端(agent/coach/chat 复用)。"""
    from openai import AsyncOpenAI

    return AsyncOpenAI(api_key=settings.deepseek_api_key, base_url=DEEPSEEK_BASE_URL)


async def stream_completion(
    model: str, messages: list[dict], **kwargs
) -> AsyncGenerator[dict, None]:
    """统一的流式补全:透传 R1 思维链(reasoning-delta)与正文(text-delta),末尾产出 finish。

    产出事件:
      {"type": "reasoning-delta", "delta": str}  # 仅 reasoner 有
      {"type": "text-delta", "delta": str}
      {"type": "finish", "model": str, "usage": dict | None}
    """
    stream = await client().chat.completions.create(
        model=model,
        messages=messages,  # type: ignore[arg-type]
        stream=True,
        stream_options={"include_usage": True},
        **kwargs,
    )
    usage: dict | None = None
    async for chunk in stream:
        if chunk.choices:
            delta = chunk.choices[0].delta
            if delta is not None:
                reasoning = getattr(delta, "reasoning_content", None)
                if reasoning:
                    yield {"type": "reasoning-delta", "delta": reasoning}
                if delta.content:
                    yield {"type": "text-delta", "delta": delta.content}
        if chunk.usage is not None:
            usage = chunk.usage.model_dump()
    yield {"type": "finish", "model": model, "usage": usage}


async def stream_chat(
    messages: list[dict[str, str]], task: str = "simple", model: str = "auto"
) -> AsyncGenerator[dict, None]:
    """普通流式对话。未配置 key 时走 stub,保证 SSE → 前端管道可独立演示。"""
    resolved = resolve_model(model, messages, task)
    if not has_llm_key():
        async for event in _stub_stream(resolved):
            yield event
        return
    async for event in stream_completion(resolved, messages):
        yield event


async def _stub_stream(model: str) -> AsyncGenerator[dict, None]:
    text = (
        "(stub 模式:后端未配置 DeepSeek key,这是占位流式输出。"
        "在 backend/.env 填入 DEEPSEEK_API_KEY 即接入真实模型。)\n\n"
        "选岗 Agent(Function Calling)与面试教练(GraphRAG)将在通电后生效。"
    )
    for ch in text:
        yield {"type": "text-delta", "delta": ch}
        await asyncio.sleep(0.008)
    yield {
        "type": "finish",
        "model": f"{model} (stub)",
        "usage": {"prompt_tokens": 0, "completion_tokens": len(text), "total_tokens": len(text)},
    }
