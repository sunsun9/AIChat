import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from app.core.config import settings

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


# ── Access Token ────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """生成短命 JWT Access Token（默认 15 分钟）。"""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=settings.APP_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """解析并验证 Access Token，过期或被篡改时抛出 401。"""
    try:
        payload = jwt.decode(
            token, settings.APP_SECRET_KEY, algorithms=[settings.APP_ALGORITHM]
        )
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="token验证失败",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── Refresh Token ───────────────────────────────────────────────────────────

def generate_refresh_token() -> tuple[str, str]:
    """
    生成 Refresh Token。
    返回 (raw_token, sha256_hex_hash)：
      - raw_token  ← 发给客户端，存入 localStorage
      - token_hash ← 存入数据库，不保存明文
    """
    raw = secrets.token_urlsafe(48)          # 48 字节随机数，base64url 编码 ≈ 64 字符
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash


def hash_refresh_token(raw: str) -> str:
    """将客户端传来的 raw refresh token 哈希，用于数据库查找。"""
    return hashlib.sha256(raw.encode()).hexdigest()
