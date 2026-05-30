"""鉴权端点:登录 / 刷新 / 当前用户(JWT 双 token + 四级 RBAC,PLAN §10)。"""

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.db.models import User
from app.db.session import SessionLocal

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginReq(BaseModel):
    username: str
    password: str


class RefreshReq(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    username: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    user: UserOut


async def _get_user(username: str | None) -> User | None:
    if not username:
        return None
    async with SessionLocal() as db:
        return (
            await db.execute(select(User).where(User.username == username))
        ).scalar_one_or_none()


def _issue(user: User) -> TokenOut:
    role = user.role or "viewer"
    return TokenOut(
        access_token=create_access_token(user.username, role),
        refresh_token=create_refresh_token(user.username, role),
        user=UserOut(username=user.username, role=role),
    )


@router.post("/login", response_model=TokenOut)
async def login(req: LoginReq) -> TokenOut:
    user = await _get_user(req.username)
    if not user or not user.pwd_hash or not verify_password(req.password, user.pwd_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户名或密码错误")
    return _issue(user)


@router.post("/refresh", response_model=TokenOut)
async def refresh(req: RefreshReq) -> TokenOut:
    try:
        payload = decode_token(req.refresh_token)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "刷新令牌无效或已过期") from None
    if payload.get("type") != "refresh":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "令牌类型错误")
    user = await _get_user(payload.get("sub"))
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "用户不存在")
    return _issue(user)


async def current_user(authorization: str | None = Header(default=None)) -> UserOut:
    """从 Authorization: Bearer <access> 解析当前用户。"""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "缺少访问令牌")
    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "访问令牌无效或已过期") from None
    if payload.get("type") != "access":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "令牌类型错误")
    return UserOut(username=payload.get("sub") or "", role=payload.get("role") or "viewer")


@router.get("/me", response_model=UserOut)
async def me(user: UserOut = Depends(current_user)) -> UserOut:
    return user


def require_role(*roles: str):
    """角色守卫依赖工厂:用于后端敏感端点的 RBAC 兜底(前端守卫之外的第二道防线)。"""

    async def _dep(user: UserOut = Depends(current_user)) -> UserOut:
        if roles and user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "权限不足")
        return user

    return _dep
