"""
文件服务 – 处理高级会员的文件上传。

支持格式：
  - .txt  → 直接 decode 文本
  - .pdf  → PyPDF2 提取全文
  - .jpg / .jpeg / .png / .gif / .webp → base64 编码，供多模态模型使用

职责：
- 验证文件类型和大小
- 使用基于 UUID 的名称安全保存到磁盘
- 提取/生成内容（文本 or base64 图像）
- 将文件元数据存储到数据库中
"""

import os
import uuid
import base64
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import FileAttachment

# ── 文件类型配置 ───
ALLOWED_EXTENSIONS = {".txt", ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"}

# MIME 类型 → 扩展名集合（宽松匹配，优先按扩展名）
ALLOWED_CONTENT_TYPES = {
    "text/plain",
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

TEXT_EXTENSIONS  = {".txt"}
PDF_EXTENSIONS   = {".pdf"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

CONTENT_PREVIEW_LENGTH = 500


# ── 内部工具 ────
def _ext(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def _validate_file(file: UploadFile, content: bytes) -> None:
    """文件类型不合法或超过大小限制时抛出 HTTPException。"""
    ext = _ext(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        allowed = "、".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"不支持的文件格式 '{ext}'，仅允许：{allowed}",
        )
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"文件过大，最大允许 {settings.MAX_FILE_SIZE_MB} MB",
        )


def _extract_text(content_bytes: bytes, filename: str) -> Tuple[str, str]:
    """
    从文件字节中提取文本或 base64 图像数据。

    Returns:
        (file_type, content_str)
        file_type: "text" | "pdf" | "image"
        content_str: 文本内容 或 "data:<mime>;base64,<data>"
    """
    ext = _ext(filename)

    # ── TXT ──
    if ext in TEXT_EXTENSIONS:
        for enc in ("utf-8", "gbk", "latin-1"):
            try:
                return "text", content_bytes.decode(enc)
            except UnicodeDecodeError:
                continue
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法解码文件，请确保是 UTF-8 / GBK / Latin-1 编码的文本",
        )

    # ── PDF ──
    if ext in PDF_EXTENSIONS:
        try:
            import io
            from PyPDF2 import PdfReader
            reader = PdfReader(io.BytesIO(content_bytes))
            pages_text = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    pages_text.append(t)
            text = "\n".join(pages_text).strip()
            if not text:
                text = "[PDF 无可提取文本，可能为扫描件]"
            return "pdf", text
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"PDF 解析失败：{str(e)}",
            )

    # ── 图像 ──
    if ext in IMAGE_EXTENSIONS:
        mime_map = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".gif": "image/gif",
            ".webp": "image/webp",
        }
        mime = mime_map.get(ext, "image/jpeg")
        b64 = base64.b64encode(content_bytes).decode("ascii")
        return "image", f"data:{mime};base64,{b64}"

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"不支持的文件格式：{ext}",
    )


# ── 公开接口 ───
async def save_upload(
    file: UploadFile,
    user_id: int,
    message_id: int,
    db: Session,
) -> FileAttachment:
    """
    读取、验证、持久化保存文件并注册到数据库。
    支持 TXT / PDF / 图片。
    返回新创建的 FileAttachment ORM 对象。
    """
    content_bytes: bytes = await file.read()
    _validate_file(file, content_bytes)

    file_type, extracted = _extract_text(content_bytes, file.filename or "")

    # 预览（图像不生成文本预览）
    if file_type == "image":
        content_preview = f"[图像文件: {file.filename}]"
    else:
        content_preview = extracted[:CONTENT_PREVIEW_LENGTH]

    # 保存原始字节到磁盘
    ext = _ext(file.filename)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_name)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content_bytes)

    # 持久化元数据
    attachment = FileAttachment(
        message_id=message_id,
        user_id=user_id,
        original_filename=file.filename or f"upload{ext}",
        stored_filename=stored_name,
        file_path=file_path,
        file_size=len(content_bytes),
        content_preview=content_preview,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def read_attachment_content(attachment: FileAttachment) -> dict:
    """
    从磁盘读取附件，返回 {"type": "text"|"pdf"|"image", "content": str}。
    text/pdf 返回全文；image 返回 base64 data URI。
    """
    if not os.path.exists(attachment.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"附件文件在服务器上不存在：{attachment.original_filename}",
        )
    with open(attachment.file_path, "rb") as f:
        raw = f.read()

    file_type, content = _extract_text(raw, attachment.original_filename)
    return {"type": file_type, "content": content, "filename": attachment.original_filename}


def get_attachment_or_404(
    attachment_id: int, user_id: int, db: Session
) -> FileAttachment:
    """确认附件归属：属于该用户则返回，否则抛出 404。"""
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
