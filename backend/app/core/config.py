from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """应用配置。优先读环境变量 / .env(LLM key 仅后端,铁律 1)。"""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # CORS:前端开发地址(生产经 .env / 环境变量覆盖)
    cors_origins: list[str] = ["http://localhost:5173"]

    # 数据库(阶段 1 启用 pgvector)
    database_url: str = "postgresql+asyncpg://gongkao:gongkao@localhost:5432/gongkao"

    # LLM / Embedding keys —— 仅后端,默认空,运行时由 .env 注入
    deepseek_api_key: str = ""
    zhipu_api_key: str = ""
    siliconflow_api_key: str = ""

    # JWT 鉴权(生产经 .env 覆盖 jwt_secret;默认 ≥32 字节满足 HS256 推荐长度)
    jwt_secret: str = "dev-only-secret-change-me-in-prod-0123456789"
    access_token_ttl_min: int = 30
    refresh_token_ttl_days: int = 7


settings = Settings()
