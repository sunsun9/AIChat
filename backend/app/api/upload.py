from fastapi import APIRouter, Depends, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.deps import require_premium
from app.core.response import ok
from app.models.models import User, Conversation, Message, MessageRole
from app.services.file_service import save_upload

router = APIRouter(prefix="/upload", tags=["File Upload"])


@router.post("/file")
async def upload_file(
    file: UploadFile = File(..., description="TXT file to upload"),
    conversation_id: Optional[int] = Form(None, description="Existing conversation ID (optional)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_premium),
):
    """
    上传 .txt 附件（仅限高级用户）。

    文件会关联一条占位消息，返回 attachment_id，
    后续在 /chat/ask 的 attachment_ids 中引用。
    """
    # 解析或创建会话
    if conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id,
        ).first()
        if not conv:
            conv = Conversation(user_id=current_user.id)
            db.add(conv)
            db.flush()
    else:
        conv = Conversation(user_id=current_user.id)
        db.add(conv)
        db.flush()

    # 创建占位消息以锚定附件
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

    return ok({
        "attachment_id": attachment.id,
        "original_filename": attachment.original_filename,
        "file_size": attachment.file_size,
        "content_preview": attachment.content_preview,
    })