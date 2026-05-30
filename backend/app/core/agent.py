"""选岗 Agent:流式 Function Calling 循环(PLAN §8.2)。

每轮:LLM(带 tools)流式 → 累积 tool_call 增量 → 若需调用则执行真算法、role:tool 回填 → 下一轮;
直到 LLM 不再调工具,流式产出最终中文建议。

SSE 事件(供前端 Agent 时间线可视化):
  {"type":"text-delta","delta":str}
  {"type":"tool-call","name":str,"args":dict}
  {"type":"tool-result","name":str,"summary":str}
  {"type":"finish","model":str,"usage":dict|None}
"""

import json
from collections.abc import AsyncGenerator

from app.core.config import settings
from app.core.llm import CHAT_MODEL, client
from app.core.prompts_store import AGENT_PROMPT_NAME, system_prompt
from app.core.tools import TOOLS, execute_tool
from app.db.session import SessionLocal

AGENT_SYSTEM_PROMPT = """你是公考选岗助手。当用户描述选岗意向时:
1. 先用 filter_jobs 按 省份/地市/年份/学历/专业/招录数 等筛选岗位;
2. 如需排序推荐,用 rank_by_value 对候选岗位 id 排序(报录比+招录数+进面分加权);
3. 如用户想在少数岗位间逐项对比,用 compare_jobs(传 2-5 个 id)看各维度最优;
4. 基于工具返回的真实数据给出简洁中文建议,引用具体岗位(单位+职位+报录比+招录数+性价比分)。
严禁编造数据,只使用工具返回的结果;数据库仅含贵州、青海两省岗位。"""

MAX_STEPS = 4


async def agent_stream(messages: list[dict]) -> AsyncGenerator[dict, None]:
    if not settings.deepseek_api_key:
        yield {"type": "text-delta", "delta": "(stub:未配置 DeepSeek key,选岗 Agent 不可用。)"}
        yield {"type": "finish", "model": "stub", "usage": None}
        return

    oai = client()
    sys_prompt = await system_prompt(AGENT_PROMPT_NAME, AGENT_SYSTEM_PROMPT)
    convo: list[dict] = [{"role": "system", "content": sys_prompt}, *messages]
    usage: dict | None = None

    async with SessionLocal() as db:
        for _ in range(MAX_STEPS):
            stream = await oai.chat.completions.create(
                model=CHAT_MODEL,
                messages=convo,  # type: ignore[arg-type]
                tools=TOOLS,  # type: ignore[arg-type]
                tool_choice="auto",
                stream=True,
                stream_options={"include_usage": True},
            )
            tool_calls: dict[int, dict] = {}
            content = ""
            finish_reason: str | None = None

            async for chunk in stream:
                if chunk.choices:
                    choice = chunk.choices[0]
                    delta = choice.delta
                    if delta and delta.content:
                        content += delta.content
                        yield {"type": "text-delta", "delta": delta.content}
                    if delta and delta.tool_calls:
                        for tcd in delta.tool_calls:
                            slot = tool_calls.setdefault(tcd.index, {"id": "", "name": "", "args": ""})
                            if tcd.id:
                                slot["id"] = tcd.id
                            if tcd.function and tcd.function.name:
                                slot["name"] = tcd.function.name
                            if tcd.function and tcd.function.arguments:
                                slot["args"] += tcd.function.arguments
                    if choice.finish_reason:
                        finish_reason = choice.finish_reason
                if chunk.usage is not None:
                    usage = chunk.usage.model_dump()

            if finish_reason == "tool_calls" and tool_calls:
                convo.append(
                    {
                        "role": "assistant",
                        "content": content or None,
                        "tool_calls": [
                            {
                                "id": s["id"],
                                "type": "function",
                                "function": {"name": s["name"], "arguments": s["args"]},
                            }
                            for s in tool_calls.values()
                        ],
                    }
                )
                for s in tool_calls.values():
                    try:
                        args = json.loads(s["args"] or "{}")
                    except json.JSONDecodeError:
                        args = {}
                    yield {"type": "tool-call", "name": s["name"], "args": args}
                    try:
                        result = await execute_tool(s["name"], args, db)
                    except Exception as exc:  # noqa: BLE001 工具异常不应中断流
                        result = {"summary": f"工具执行出错:{exc}", "data": {"error": str(exc)}}
                    yield {"type": "tool-result", "name": s["name"], "summary": result["summary"]}
                    convo.append(
                        {
                            "role": "tool",
                            "tool_call_id": s["id"],
                            "content": json.dumps(result["data"], ensure_ascii=False),
                        }
                    )
                continue

            yield {"type": "finish", "model": CHAT_MODEL, "usage": usage}
            return

    yield {"type": "finish", "model": "deepseek-chat", "usage": usage}
