"""
文件服务 – 处理高级会员的 TXT 文件上传。

职责：
- 验证文件类型和大小
- 使用基于 UUID 的名称将文件安全保存到磁盘
- 提取文本内容
- 将文件元数据存储到数据库中
"""

import os
import uuid
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import FileAttachment

ALLOWED_CONTENT_TYPES = {"text/plain"}
ALLOWED_EXTENSIONS = {".txt"}
CONTENT_PREVIEW_LENGTH = 500


def _validate_file(file: UploadFile, content: bytes) -> None:
    """如果文件不是有效的 .txt 或超过大小限制，则抛出 HTTPException。"""
    # 文件类型检查
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"仅允许上传 .txt 文件。当前文件格式: '{ext}'",
        )

    # 文件大小检验
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"文件过大。最大允许大小为 {settings.MAX_FILE_SIZE_MB} MB。",
        )


async def save_upload(
    file: UploadFile,
    user_id: int,
    message_id: int,
    db: Session,
) -> FileAttachment:
    """
    读取、验证、持久化保存并注册 TXT 文件。

    返回新创建的 FileAttachment ORM (数据库模型) 对象。
    """
    content_bytes: bytes = await file.read()
    _validate_file(file, content_bytes)

    # 解码附件内容
    try:
        text_content = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            text_content = content_bytes.decode("gbk")
        except UnicodeDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="无法解码文件。请确保文件是 UTF-8 或 GBK 编码的文本。",
            )

    # 构建安全的存储文件名
    stored_name = f"{uuid.uuid4().hex}.txt"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_name)

    # 写入服务器
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(text_content)

    # 持久化元数据
    attachment = FileAttachment(
        message_id=message_id,
        user_id=user_id,
        original_filename=file.filename or "upload.txt",
        stored_filename=stored_name,
        file_path=file_path,
        file_size=len(content_bytes),
        content_preview=text_content[:CONTENT_PREVIEW_LENGTH],
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def read_attachment_content(attachment: FileAttachment) -> str:
    """从磁盘读取已存储附件的完整文本内容。"""
    if not os.path.exists(attachment.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"在服务器磁盘上未找到附件文件：{attachment.original_filename}",
        )
    with open(attachment.file_path, "r", encoding="utf-8") as f:
        return f.read()


def get_attachment_or_404(
    attachment_id: int, user_id: int, db: Session
) -> FileAttachment:
    """确认附件归属：如果附件属于该用户则返回，否则抛出 404 错误。"""
    att = (
        db.query(FileAttachment)
        .filter(
            FileAttachment.id == attachment_id,
            FileAttachment.user_id == user_id,
        )
        .first()
    )
    if not att:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"未找到 ID 为 {attachment_id} 的附件，或您无权访问",
        )
    return att
