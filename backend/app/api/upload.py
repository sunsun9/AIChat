"""
上传路由 – 仅限高级会员用户访问。

POST /upload/file
  → 接收一个 .txt 文件
  → 在（新的或已存在的）对话中创建一个“占位符”用户消息
  → 保存文件并返回附件 ID，以便在后续的 /chat 请求中使用
"""

from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.deps import require_premium
from app.models.models import User, Conversation, Message, MessageRole
from app.schemas.schemas import UploadResponse
from app.services.file_service import save_upload

router = APIRouter(prefix="/upload", tags=["File Upload"])


@router.post("/file", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(..., description="要上传的 TXT 文件"),
    conversation_id: Optional[int] = Form(None, description="已存在的对话 ID（可选）"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_premium),      # 需要通过高级用户权限验证
):
    """
    上传 .txt 附件（仅限高级会员）。

    该文件将被链接到一个临时的“占位符”消息上，这样当用户稍后通过 /chat 
    发送他们的问题时，就可以通过 ID 引用这个文件。
    返回 attachment_id 以便包含在 ChatRequest 中。
    """
    # 解析现有对话或创建新对话
    if conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        ).first()
        if not conv:
            # 如果没找到，则静默创建一个新的；前端可以自行协调
            conv = Conversation(user_id=current_user.id)
            db.add(conv)
            db.flush()
    else:
        conv = Conversation(user_id=current_user.id)
        db.add(conv)
        db.flush()

    # 创建一个占位符用户消息，用来“锚定”这个附件
    placeholder = Message(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content="[file upload placeholder]",
    )
    db.add(placeholder)
    db.flush()

    attachment = await save_upload(
        file=file,
        user_id=current_user.id,
        message_id=placeholder.id,
        db=db,
    )

    return UploadResponse(
        attachment_id=attachment.id,
        original_filename=attachment.original_filename,
        file_size=attachment.file_size,
        content_preview=attachment.content_preview,
    )
