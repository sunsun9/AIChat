"""
file_service.py — 文件上传服务

支持格式：
  - .txt  → 直接 decode 文本
  - .md   → Markdown 文档，直接 decode 文本（保留原始语法，便于 LLM 理解结构）
  - .pdf  → PyPDF2 提取全文
  - .jpg / .jpeg / .png / .gif / .webp → base64 编码供多模态模型使用

职责：
- 验证文件类型和大小
- UUID 命名安全存盘
- 提取/生成内容（文本 or base64 图像）
- 将文件元数据写入数据库
"""

import os
import uuid
import base64
from typing import Tuple
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import FileAttachment

# ── 文件类型配置 ────────────────────────────────────────────────────

ALLOWED_EXTENSIONS = {".txt", ".md", ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp"}

ALLOWED_CONTENT_TYPES = {
    "text/plain",
    "text/markdown",
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
}

TEXT_EXTENSIONS  = {".txt", ".md"}
PDF_EXTENSIONS   = {".pdf"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

CONTENT_PREVIEW_LENGTH = 500


# ── 内部工具 ────
def _ext(filename: str) -> str:
    return os.path.splitext(filename or "")[1].lower()


def _validate_file(file: UploadFile, content: bytes) -> None:
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
    Returns:
        (file_type, content_str)
        file_type: "text" | "markdown" | "pdf" | "image"
        content_str: 文本内容 或 "data:<mime>;base64,<data>"
    """
    ext = _ext(filename)

    # ── TXT / MD ──
    if ext in TEXT_EXTENSIONS:
        for enc in ("utf-8", "gbk", "latin-1"):
            try:
                text = content_bytes.decode(enc)
                ftype = "markdown" if ext == ".md" else "text"
                return ftype, text
            except UnicodeDecodeError:
                continue
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="无法解码文件，请确保是 UTF-8 / GBK / Latin-1 编码",
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
    content_bytes: bytes = await file.read()
    _validate_file(file, content_bytes)

    file_type, extracted = _extract_text(content_bytes, file.filename or "")

    if file_type == "image":
        content_preview = f"[图像文件: {file.filename}]"
    else:
        content_preview = extracted[:CONTENT_PREVIEW_LENGTH]

    ext = _ext(file.filename)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(settings.UPLOAD_DIR, stored_name)
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    with open(file_path, "wb") as f:
        f.write(content_bytes)

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
    if not os.path.exists(attachment.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"附件文件在服务器上不存在：{attachment.original_filename}",
        )
    with open(attachment.file_path, "rb") as f:
        raw = f.read()

    file_type, content = _extract_text(raw, attachment.original_filename)
    return {
        "type": file_type,
        "content": content,
        "filename": attachment.original_filename,
    }


def get_attachment_or_404(
    attachment_id: int, user_id: int, db: Session
) -> FileAttachment:
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
