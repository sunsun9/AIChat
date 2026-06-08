from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime
from app.models.models import UserRole, MessageRole


# ─────────────────────────── Auth / User ────────────────────────────

class UserRegister(BaseModel):
    username: str
    password: str
    role: UserRole = UserRole.NORMAL

    # 参数检验
    @field_validator("username")
    @classmethod
    def username_valid(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3:
            raise ValueError("用户名至少需要3个字符")
        if len(v) > 50:
            raise ValueError("用户名最多为50个字符")
        return v

    @field_validator("password")
    @classmethod
    def password_valid(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("密码至少6位")
        return v


class UserLogin(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserInfo"


class UserInfo(BaseModel):
    id: int
    username: str
    role: UserRole
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────── File Attachment ────────────────────────

class FileAttachmentInfo(BaseModel):
    id: int
    original_filename: str
    file_size: int
    content_preview: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─────────────────────────── Message ────────────────────────────────

class MessageOut(BaseModel):
    id: int
    role: MessageRole
    content: str
    created_at: datetime
    attachments: List[FileAttachmentInfo] = []

    model_config = {"from_attributes": True}


# ─────────────────────────── Conversation ───────────────────────────

class ConversationCreate(BaseModel):
    title: Optional[str] = "新对话"


class ConversationRename(BaseModel):
    title: str

    @field_validator("title")
    @classmethod
    def title_valid(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("对话名称不能为空")
        if len(v) > 100:
            raise ValueError("对话名称最多100个字符")
        return v


class ConversationOut(BaseModel):
    id: int
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0

    model_config = {"from_attributes": True}


class ConversationDetail(ConversationOut):
    messages: List[MessageOut] = []


# ─────────────────────────── Chat / Q&A ─────────────────────────────

class ChatRequest(BaseModel):
    conversation_id: Optional[int] = None   # None 默认创建新对话
    question: str
    attachment_ids: Optional[List[int]] = []  # 之前上传文件的ID

    @field_validator("question")
    @classmethod
    def question_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("输入不能为空")
        return v


class ChatResponse(BaseModel):
    conversation_id: int
    message_id: int
    answer: str
    used_attachments: List[FileAttachmentInfo] = []


# ─────────────────────────── Upload ─────────────────────────────────

class UploadResponse(BaseModel):
    attachment_id: int
    original_filename: str
    file_size: int
    content_preview: Optional[str] = None
    message: str = "文件上传成功"


# ─────────────────────────── Generic ────────────────────────────────

class MessageResponse(BaseModel):
    message: str


TokenResponse.model_rebuild()
