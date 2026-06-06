"""
LLM Q&A System – FastAPI Backend
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import os

from app.core.database import engine, Base
from app.core.config import settings
from app.api import auth, chat, upload

# ── 数据库初始化 ───
Base.metadata.create_all(bind=engine)

# ── App factory ───
app = FastAPI(
    title="LLM Q&A System",
    description=(
        "Intelligent Q&A system powered by Claude. "
        "Supports role-based access: normal users (text only) "
        "and premium users (text + file attachments)."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── 全局异常处理：统一包装为 { code, msg, data } ─────────────────────

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"code": exc.status_code, "msg": exc.detail, "data": None},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    msg = exc.errors()[0]["msg"] if exc.errors() else "请求参数校验失败"
    return JSONResponse(
        status_code=422,
        content={"code": 422, "msg": msg, "data": None},
    )

# ── 路由 ───
app.include_router(auth.router,   prefix="/api/v1")
app.include_router(chat.router,   prefix="/api/v1")
app.include_router(upload.router, prefix="/api/v1")


# ── Health check ───
@app.get("/health", tags=["System"])
def health():
    return {"code": 0, "msg": "success", "data": {"status": "ok", "service": "LLM Q&A Backend"}}


# ── Serve uploaded files (dev convenience) ───
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")