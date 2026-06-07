import json
from typing import List, AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.response import ok
from app.models.models import (
    User, UserRole, Conversation, Message, MessageRole, FileAttachment
)
from app.schemas.schemas import (
    ChatRequest, ConversationOut, FileAttachmentInfo, MessageOut
)
from app.services.llm_service import ask_llm_stream
from app.services.file_service import read_attachment_content, get_attachment_or_404

router = APIRouter(prefix="/chat", tags=["Chat / Q&A"])


# ─────────────────────────── SSE 工具函数 ────────────────────────────

def _sse_event(event: str, data: str | dict) -> str:
    """格式化单条 SSE 消息。"""
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


async def _stream_ask(
    conv: Conversation,
    payload: ChatRequest,
    history: list,
    file_contents: list,
    used_attachments: list[FileAttachment],
    db: Session,
) -> AsyncGenerator[str, None]:
    """
    核心流式生成器：
      1. 先 yield metadata（conversation_id、message_id 占位）
      2. 逐 token yield delta
      3. 全部完成后保存 DB，yield done 事件
    """
    # ── 1. 先保存用户消息，拿到 conv_id ──
    user_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content=payload.question,
    )
    db.add(user_msg)
    db.flush()

    for att in used_attachments:
        att.message_id = user_msg.id

    # 创建 AI 消息占位（content 后面再更新）
    assistant_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content="",
    )
    db.add(assistant_msg)
    db.flush()
    db.commit()

    # ── 2. 发送 metadata 事件（前端靠此切换到正确 conversation）──
    yield _sse_event("metadata", {
        "conversation_id": conv.id,
        "message_id": assistant_msg.id,
        "used_attachments": [
            FileAttachmentInfo.model_validate(a).model_dump(mode="json")
            for a in used_attachments
        ],
    })

    # ── 3. 逐 token 流式输出 ──
    full_answer: list[str] = []
    try:
        async for chunk in ask_llm_stream(
            history=history,
            question=payload.question,
            file_contents=file_contents or None,
        ):
            full_answer.append(chunk)
            yield _sse_event("delta", {"text": chunk})
    except Exception as exc:
        # 出错时通知前端
        yield _sse_event("error", {"msg": f"LLM 服务异常：{str(exc)}"})
        # 清理空的 assistant_msg
        db.delete(assistant_msg)
        db.commit()
        return

    # ── 4. 拼接完整回复，写回数据库 ──
    answer_text = "".join(full_answer)
    assistant_msg.content = answer_text
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    yield _sse_event("done", {
        "message_id": assistant_msg.id,
        "conversation_id": conv.id,
    })


# ─────────────────────────── Ask（流式 SSE）─────────────────────────

@router.post("/ask")
async def ask(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交问题，以 SSE 流式返回 AI 回答。"""

    # ── 1. 解析或创建会话 ────
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == current_user.id,
        ).first()
        if not conv:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="会话不存在",
            )
    else:
        title = payload.question[:40] + ("…" if len(payload.question) > 40 else "")
        conv = Conversation(user_id=current_user.id, title=title)
        db.add(conv)
        db.flush()
        db.commit()

    # ── 2. 处理附件（仅 premium 用户）──
    file_contents: List[dict] = []
    used_attachments: List[FileAttachment] = []

    if payload.attachment_ids:
        if current_user.role != UserRole.PREMIUM:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="附件功能仅限高级用户使用",
            )
        for att_id in payload.attachment_ids:
            att = get_attachment_or_404(att_id, current_user.id, db)
            content = read_attachment_content(att)
            file_contents.append({"filename": att.original_filename, "content": content})
            used_attachments.append(att)

    # ── 3. 构建历史消息上下文 ───
    prior_messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conv.id,
            Message.content != "[file upload placeholder]",
            Message.content != "",  # 过滤掉流式占位
        )
        .order_by(Message.created_at)
        .limit(20)
        .all()
    )
    history = [
        {"role": msg.role.value, "content": msg.content}
        for msg in prior_messages
    ]

    # ── 4. 返回 SSE 流 ──
    return StreamingResponse(
        _stream_ask(conv, payload, history, file_contents, used_attachments, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # 关闭 Nginx 缓冲
            "Connection": "keep-alive",
        },
    )


# ─────────────────────────── Conversations ──────────────────────────

@router.get("/conversations")
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """返回当前用户的所有会话，按最后更新时间倒序排列。"""
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
            Message.content != "",
        ).count()
        out = ConversationOut.model_validate(c).model_dump(mode="json")
        out["message_count"] = count
        result.append(out)
    return ok(result)


@router.get("/conversations/{conv_id}")
def get_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """返回指定会话及其所有消息。"""
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conv_id,
            Message.content != "[file upload placeholder]",
            Message.content != "",
        )
        .order_by(Message.created_at)
        .all()
    )
    detail = ConversationOut.model_validate(conv).model_dump(mode="json")
    detail["message_count"] = len(messages)
    detail["messages"] = [
        MessageOut.model_validate(m).model_dump(mode="json") for m in messages
    ]
    return ok(detail)


@router.delete("/conversations/{conv_id}")
def delete_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """删除会话及其所有消息（级联删除）。"""
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    db.delete(conv)
    db.commit()
    return ok(msg="删除成功")
