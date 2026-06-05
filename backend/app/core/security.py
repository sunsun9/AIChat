from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import HTTPException, status
from app.core.config import settings

# 密码加密上下文
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # 验证hash密码
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    # hash加密
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    # 生成token
    to_encode = data.copy()     # 一般是 user id 相关内容
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.APP_SECRET_KEY, algorithm=settings.APP_ALGORITHM)


def decode_access_token(token: str) -> dict:
    # 解析token
    try:
        # 验证token未被篡改且未过期后，返回payload
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
