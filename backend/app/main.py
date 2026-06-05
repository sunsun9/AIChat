"""
LLM 问答系统 – FastAPI 后端主入口
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from app.core.database import engine, Base
from app.core.config import settings
from app.api import auth, chat, upload

# ── 在应用启动时，自动创建所有数据库表 ──
Base.metadata.create_all(bind=engine)

# ── App factory ──
app = FastAPI(
    title="LLM 问答系统",
    description=(
        "基于 Claude 驱动的智能问答系统。 "
        "支持基于角色的权限控制：普通用户（仅限纯文本聊天） "
        "和高级会员（支持文本 + 文件附件上传）。"
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── Health check ─────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health():
    return {"status": "ok", "service": "LLM Q&A Backend"}


# ── Serve uploaded files (dev convenience) ───────────────────────────
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
