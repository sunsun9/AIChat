from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # App
    APP_SECRET_KEY: str = "dev-secret-key-change-in-production"
    APP_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Database
    DATABASE_URL: str = "sqlite:///./aichat.db"

    # LLM (DashScope / Qwen)
    DASHSCOPE_API_KEY: str = ""

    # File Upload
    UPLOAD_DIR: str = "uploads"
    MAX_FILE_SIZE_MB: int = 10

    # ── 短期记忆：滑动窗口 ──────────────────────────────────────────────
    # 发给 LLM 的历史消息 token 预算（不含 system prompt）
    MEMORY_SHORT_TERM_MAX_TOKENS: int = 4000
    # 单条消息最大 token 数（超出则截断预览）
    MEMORY_MSG_MAX_TOKENS: int = 800

    # ── 长期记忆：RAG 向量数据库 ───
    # ChromaDB 持久化路径（相对于工作目录）
    MEMORY_VECTOR_DB_PATH: str = "./memory_db"
    # 当会话消息数达到此倍数时触发自动摘要（0 = 关闭）
    MEMORY_SUMMARIZE_THRESHOLD: int = 20
    # 每次 RAG 检索返回的最大条数
    MEMORY_RETRIEVAL_TOP_K: int = 3
    # 摘要最大 token 数
    MEMORY_SUMMARY_MAX_TOKENS: int = 400

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs(settings.MEMORY_VECTOR_DB_PATH, exist_ok=True)
