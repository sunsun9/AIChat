from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import (
    get_password_hash, verify_password,
    create_access_token,
    generate_refresh_token, hash_refresh_token,
)
from app.core.deps import get_current_user
from app.core.response import ok
from app.core.config import settings
from app.models.models import User, RefreshToken
from app.schemas.schemas import UserRegister, UserLogin, UserInfo

router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── 内部辅助：生成 token 对 ──────────────────────────────────────────────

def _issue_token_pair(user: User, db: Session) -> dict:
    """
    为指定用户签发 access token + refresh token，
    将 refresh token 哈希写入 DB，返回两个 token 的字典。
    """
    access_token = create_access_token({"sub": str(user.id)})

    raw_rt, rt_hash = generate_refresh_token()
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    db_rt = RefreshToken(
        user_id=user.id,
        token_hash=rt_hash,
        expires_at=expires_at,
    )
    db.add(db_rt)
    db.commit()

    return {
        "token": access_token,
        "refresh_token": raw_rt,
        "user": UserInfo.model_validate(user).model_dump(mode="json"),
    }


# ── 请求体 Schema ────────────────────────────────────────────────────────

class RefreshRequest(BaseModel):
    refresh_token: str

class LogoutRequest(BaseModel):
    refresh_token: str


# ── 路由 ─────────────────────────────────────────────────────────────────

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    """注册新用户账号。"""
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="用户名已被占用",
        )

    user = User(
        username=payload.username,
        hashed_password=get_password_hash(payload.password),
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return ok(UserInfo.model_validate(user).model_dump(mode="json"))


@router.post("/login")
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """
    用户登录。
    返回 access_token（15 分钟）+ refresh_token（30 天）。
    """
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="账号已被禁用",
        )

    return ok(_issue_token_pair(user, db))


@router.post("/refresh")
def refresh_tokens(payload: RefreshRequest, db: Session = Depends(get_db)):
    """
    用 refresh_token 换取新的 access_token + refresh_token（自动轮转）。
    旧 refresh_token 立即吊销，防止重放攻击。
    """
    rt_hash = hash_refresh_token(payload.refresh_token)

    db_rt = (
        db.query(RefreshToken)
        .filter(RefreshToken.token_hash == rt_hash)
        .first()
    )

    # Token 不存在
    if db_rt is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh_token 无效",
        )

    # Token 已被吊销（可能是重放攻击）
    if db_rt.is_revoked:
        # 安全起见：吊销该用户所有 refresh token，强制重新登录
        db.query(RefreshToken).filter(RefreshToken.user_id == db_rt.user_id).update(
            {"is_revoked": True}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh_token 已失效，请重新登录",
        )

    # Token 已过期
    if db_rt.expires_at < datetime.now(timezone.utc):
        db_rt.is_revoked = True
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="refresh_token 已过期，请重新登录",
        )

    user = db.query(User).filter(User.id == db_rt.user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被禁用",
        )

    # 吊销旧 token，签发新 token 对（轮转）
    db_rt.is_revoked = True
    db.commit()

    return ok(_issue_token_pair(user, db))


@router.post("/logout")
def logout(payload: LogoutRequest, db: Session = Depends(get_db)):
    """
    退出登录：吊销当前 refresh_token。
    access_token 在过期前仍有效（无状态 JWT 特性），但持续时间很短（15 分钟）。
    """
    rt_hash = hash_refresh_token(payload.refresh_token)
    db.query(RefreshToken).filter(RefreshToken.token_hash == rt_hash).update(
        {"is_revoked": True}
    )
    db.commit()
    return ok({"message": "已退出登录"})


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前已登录用户信息。"""
    return ok(UserInfo.model_validate(current_user).model_dump(mode="json"))
