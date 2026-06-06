from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.deps import get_current_user
from app.core.response import ok
from app.models.models import User
from app.schemas.schemas import UserRegister, UserLogin, UserInfo

router = APIRouter(prefix="/auth", tags=["Authentication"])


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
    """用户登录，返回 JWT Token。"""
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

    token = create_access_token({"sub": str(user.id)})
    return ok({
        "token": token,
        "user": UserInfo.model_validate(user).model_dump(mode="json"),
    })


@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    """获取当前已登录用户信息。"""
    return ok(UserInfo.model_validate(current_user).model_dump(mode="json"))