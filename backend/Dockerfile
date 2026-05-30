# 后端镜像 —— uv 驱动(PLAN §3/§11)
FROM python:3.12-slim

# 装 uv(从官方镜像拷贝二进制,免编译)
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# 先装依赖(利用 Docker 层缓存:仅 lock 变化时才重装)
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# 拷贝应用代码
COPY app ./app

ENV PATH="/app/.venv/bin:$PATH"
EXPOSE 8000

# /health 探活
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/health').status==200 else 1)"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
