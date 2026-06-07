import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.core.deps import require_premium
from app.core.response import ok
from app.models.models import User, Conversation, Message, MessageRole, FileAttachment
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


@router.delete("/file/{attachment_id}")
def delete_attachment(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_premium),
):
    """
    删除用户取消上传时残留的附件（仅限高级用户，且只能删除自己的附件）。

    依次清理：
      1. 磁盘文件
      2. FileAttachment 记录
      3. 若关联的占位消息无其他附件 → 删除占位消息
      4. 若会话已无实际消息 → 删除会话（避免空会话残留在侧边栏）
    """
    att = db.query(FileAttachment).filter(
        FileAttachment.id == attachment_id,
        FileAttachment.user_id == current_user.id,
    ).first()
    if not att:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="附件不存在或无权删除",
        )

    # 1. 删除磁盘文件
    if os.path.exists(att.file_path):
        os.remove(att.file_path)

    # 2. 记录关联消息 ID，再删附件记录
    message_id = att.message_id
    db.delete(att)
    db.flush()

    # 3. 若关联消息是占位消息且已无附件，删除消息
    if message_id:
        msg = db.query(Message).filter(Message.id == message_id).first()
        if msg and msg.content == "[file upload placeholder]":
            remaining = db.query(FileAttachment).filter(
                FileAttachment.message_id == message_id
            ).count()
            if remaining == 0:
                conv_id = msg.conversation_id
                db.delete(msg)
                db.flush()

                # 4. 若会话已无实际消息，删除会话
                real_msg_count = db.query(Message).filter(
                    Message.conversation_id == conv_id,
                    Message.content != "[file upload placeholder]",
                    Message.content != "",
                ).count()
                if real_msg_count == 0:
                    conv = db.query(Conversation).filter(
                        Conversation.id == conv_id,
                        Conversation.user_id == current_user.id,
                    ).first()
                    if conv:
                        db.delete(conv)

    db.commit()
    return ok(msg="附件已删除")