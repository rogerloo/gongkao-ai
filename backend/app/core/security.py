"""密码哈希与 JWT 双 token(PLAN §10:JWT 双 token + 四级 RBAC)。"""

import datetime as dt

import bcrypt
import jwt

from app.core.config import settings

ALGORITHM = "HS256"


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


def _token(sub: str, role: str, kind: str, ttl: dt.timedelta) -> str:
    now = dt.datetime.now(tz=dt.UTC)
    payload = {"sub": sub, "role": role, "type": kind, "iat": now, "exp": now + ttl}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(sub: str, role: str) -> str:
    return _token(sub, role, "access", dt.timedelta(minutes=settings.access_token_ttl_min))


def create_refresh_token(sub: str, role: str) -> str:
    return _token(sub, role, "refresh", dt.timedelta(days=settings.refresh_token_ttl_days))


def decode_token(token: str) -> dict:
    """解码并校验签名/过期;失败抛 jwt.PyJWTError 子类。"""
    return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
