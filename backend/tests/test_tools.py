"""性价比归一化与权重(纯函数,无 DB/LLM)。"""

from app.core.tools import VALUE_WEIGHTS, _norm


def test_norm_none_is_neutral():
    assert _norm(None, [1.0, 2.0, 3.0], invert=False) == 0.5


def test_norm_empty_array_is_neutral():
    assert _norm(5.0, [], invert=False) == 0.5


def test_norm_no_spread_is_neutral():
    assert _norm(3.0, [3.0, 3.0], invert=False) == 0.5


def test_norm_minmax_scaling():
    assert _norm(1.0, [1.0, 3.0], invert=False) == 0.0
    assert _norm(3.0, [1.0, 3.0], invert=False) == 1.0
    assert _norm(2.0, [1.0, 3.0], invert=False) == 0.5


def test_norm_invert():
    assert _norm(1.0, [1.0, 3.0], invert=True) == 1.0
    assert _norm(3.0, [1.0, 3.0], invert=True) == 0.0


def test_value_weights_sum_to_one():
    assert abs(sum(VALUE_WEIGHTS.values()) - 1.0) < 1e-9
