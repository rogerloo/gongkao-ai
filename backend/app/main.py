from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import current_user, require_role
from app.api.auth import router as auth_router
from app.api.chat import router as chat_router
from app.api.interview import router as interview_router
from app.api.jobs import router as jobs_router
from app.api.kb import router as kb_router
from app.api.prompts import router as prompts_router
from app.api.usage import router as usage_router
from app.core.config import settings

# 角色守卫:中后台菜单的服务端兜底(与前端 routes.meta.roles 对齐)
editor_admin = require_role("admin", "editor")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # 启动 / 关闭钩子。阶段 1 在此初始化 DB 连接池与 LLM 客户端。
    yield


app = FastAPI(title="公考 AI 工作台 API", version="0.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# /api/auth/login 等(公开)
app.include_router(auth_router, prefix="/api")
# /api/chat/stream 等(需登录)
app.include_router(chat_router, prefix="/api", dependencies=[Depends(current_user)])
# /api/interview/score(需登录)
app.include_router(interview_router, prefix="/api", dependencies=[Depends(current_user)])
# /api/jobs/stats 等(需登录)
app.include_router(jobs_router, prefix="/api", dependencies=[Depends(current_user)])
# /api/prompts 等(admin/editor)
app.include_router(prompts_router, prefix="/api", dependencies=[Depends(editor_admin)])
# /api/kb 等(admin/editor)
app.include_router(kb_router, prefix="/api", dependencies=[Depends(editor_admin)])
# /api/llm/usage(admin/editor)
app.include_router(usage_router, prefix="/api", dependencies=[Depends(editor_admin)])


@app.get("/health")
async def health() -> dict[str, str]:
    """健康检查(部署探活 / docker healthcheck)。"""
    return {"status": "ok", "service": "gongkao-ai-backend"}


@app.get("/")
async def root() -> dict[str, str]:
    return {"name": "公考 AI 工作台 API", "docs": "/docs", "health": "/health"}
