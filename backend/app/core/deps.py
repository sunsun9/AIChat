from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.models import User, UserRole

# 拦截获取token
bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """解码JWT 获取用户标识并返回"""
    payload = decode_access_token(credentials.credentials)
    raw_sub = payload.get("sub")
    if raw_sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 token 信息",
        )
    try:
        user_id = int(raw_sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="无效的 token 信息",
        )

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或账号已被禁用",
        )
    return user


def require_premium(current_user: User = Depends(get_current_user)) -> User:
    """如果用户非高级用户 抛出403"""
    if current_user.role != UserRole.PREMIUM:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="此功能仅限高级用户使用",
        )
    return current_user
