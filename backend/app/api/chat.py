"""
聊天路由 – 与大语言模型 (LLM) 进行问答交互。

POST /chat/ask
  → 接收问题 + 可选的附件 ID 列表（仅限高级会员）
  → 返回 AI 的回答

GET  /chat/conversations
  → 列出当前用户的所有历史对话记录

GET  /chat/conversations/{conv_id}
  → 获取单个对话的完整详情和消息列表

DELETE /chat/conversations/{conv_id}
  → 删除指定的对话及其所有消息
"""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.models import (
    User, UserRole, Conversation, Message, MessageRole, FileAttachment
)
from app.schemas.schemas import (
    ChatRequest, ChatResponse, ConversationOut, ConversationDetail,
    FileAttachmentInfo, MessageResponse
)
from app.services.llm_service import ask_llm
from app.services.file_service import read_attachment_content, get_attachment_or_404

router = APIRouter(prefix="/chat", tags=["Chat / Q&A"])


# ─────────────────────────── 问答接口 ────────────────────────────────────

@router.post("/ask", response_model=ChatResponse)
async def ask(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交问题并获取 AI 的回答。"""

    # ── 1. 解析现有对话或创建新对话 ──
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == current_user.id,
        ).first()
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="对话不存在",
            )
    else:
        # 自动截取问题的前 40 个字符作为新对话的标题
        title = payload.question[:40] + ("…" if len(payload.question) > 40 else "")
        conv = Conversation(user_id=current_user.id, title=title)
        db.add(conv)
        db.flush()

    # ── 2. 处理附件（仅限高级会员） ──
    file_contents: List[dict] = []
    used_attachments: List[FileAttachment] = []

    if payload.attachment_ids:
        if current_user.role != UserRole.PREMIUM:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="文件附件问答功能仅限高级会员 (Premium) 使用",
            )
        for att_id in payload.attachment_ids:
            att = get_attachment_or_404(att_id, current_user.id, db)
            content = read_attachment_content(att)
            file_contents.append({"filename": att.original_filename, "content": content})
            used_attachments.append(att)

    # ── 3. 为 LLM 构建对话历史上下文 ──
    prior_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conv.id,
            Message.content != "[file upload placeholder]",
        )
        .order_by(Message.created_at)
        .limit(20)          # keep context manageable
        .all()
    )
    history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in prior_messages
    ]

    # ── 4. 调用 AI 核心服务 ──
    try:
        answer = await ask_llm(
            history=history,
            question=payload.question,
            file_contents=file_contents or None,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"服务暂时不可用: {str(exc)}",
        )

    # ── 5. 将用户的提问存入数据库 ──
    user_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content=payload.question,
    )
    db.add(user_msg)
    db.flush()

    # 关键逻辑：将刚才用到的附件，从临时占位符重新绑定到这条真正的用户消息上！
    for att in used_attachments:
        att.message_id = user_msg.id

    # ── 6. 将 AI 的回答存入数据库 ──
    assistant_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content=answer,
    )
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    return ChatResponse(
        conversation_id=conv.id,
        message_id=assistant_msg.id,
        answer=answer,
        used_attachments=[
            FileAttachmentInfo.model_validate(a) for a in used_attachments
        ],
    )


# ─────────────────────────── 对话历史管理 ──────────────────────────

@router.get("/conversations", response_model=List[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """返回当前登录用户的所有对话列表"""
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    result = []
    for c in convs:
        count = db.query(Message).filter(
            Message.conversation_id == c.id,
            Message.content != "[file upload placeholder]",
        ).count()
        out = ConversationOut.model_validate(c)
        out.message_count = count
        result.append(out)
    return result


@router.get("/conversations/{conv_id}", response_model=ConversationDetail)
def get_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """返回单个对话的详细信息及其包含的所有聊天记录"""
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="对话不存在")

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conv_id,
            Message.content != "[file upload placeholder]",
        )
        .order_by(Message.created_at)
        .all()
    )
    count = len(messages)
    detail = ConversationDetail.model_validate(conv)
    detail.messages = messages
    detail.message_count = count
    return detail


@router.delete("/conversations/{conv_id}", response_model=MessageResponse)
def delete_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除对话及其所有消息"""
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="对话不存在")

    db.delete(conv)
    db.commit()
    return MessageResponse(message="成功删除对话")
