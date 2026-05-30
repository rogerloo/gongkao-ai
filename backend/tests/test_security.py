"""密码哈希与 JWT 双 token(纯函数)。"""

import jwt
import pytest

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)


def test_password_roundtrip():
    h = hash_password("admin123")
    assert h != "admin123"  # 不是明文
    assert verify_password("admin123", h)
    assert not verify_password("wrong", h)


def test_verify_bad_hash_is_false():
    assert verify_password("x", "not-a-bcrypt-hash") is False


def test_access_token_roundtrip():
    payload = decode_token(create_access_token("admin", "admin"))
    assert payload["sub"] == "admin"
    assert payload["role"] == "admin"
    assert payload["type"] == "access"


def test_refresh_token_type_and_role():
    payload = decode_token(create_refresh_token("u", "viewer"))
    assert payload["type"] == "refresh"
    assert payload["role"] == "viewer"


def test_tampered_token_rejected():
    token = create_access_token("admin", "admin")
    with pytest.raises(jwt.PyJWTError):
        decode_token(token + "tampered")
