"""多模型 auto 路由启发式(纯函数)。"""

from app.core.llm import CHAT_MODEL, REASONER_MODEL, resolve_model


def _u(text: str) -> list[dict]:
    return [{"role": "user", "content": text}]


def test_explicit_model_wins():
    assert resolve_model(REASONER_MODEL, _u("你好")) == REASONER_MODEL
    assert resolve_model(CHAT_MODEL, _u("请详细分析这道题")) == CHAT_MODEL


def test_auto_short_question_is_chat():
    assert resolve_model("auto", _u("你好")) == CHAT_MODEL


def test_auto_analytic_question_is_reasoner():
    assert resolve_model("auto", _u("请分析这道综合分析题的答题思路")) == REASONER_MODEL


def test_auto_long_question_is_reasoner():
    assert resolve_model("auto", _u("题" * 60)) == REASONER_MODEL


def test_task_complex_forces_reasoner():
    assert resolve_model("auto", _u("你好"), task="complex") == REASONER_MODEL


def test_unknown_model_falls_back_to_chat():
    assert resolve_model("gpt-x", _u("你好")) == CHAT_MODEL
