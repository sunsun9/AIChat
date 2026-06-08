"""
chat.py — 聊天 API

流程（ask 接口）：
  1. 解析/创建会话
  2. 验证附件权限
  3. 并发获取：滑动窗口短期历史 + RAG 长期记忆
  4. SSE 流式推送
  5. 完成后异步触发自动摘要（不阻塞响应）

错误处理改动：
  - LLM 超时、空响应、不可用分类推送到前端 SSE error 事件
  - 流式生成器内部异常不会导致静默失败，统一 yield error 事件并清理 DB
  - 保留 assistant_msg 占位行的 finally 清理逻辑，避免脏数据
"""

import asyncio
import json
import logging
from typing import List, AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db, SessionLocal
from app.core.deps import get_current_user
from app.core.response import ok
from app.models.models import (
    User, UserRole, Conversation, Message, MessageRole, FileAttachment
)
from app.schemas.schemas import (
    ChatRequest, ConversationOut, ConversationRename, FileAttachmentInfo, MessageOut
)
from app.services.llm_service import (
    ask_llm_stream,
    LLMTimeoutError,
    LLMUnavailableError,
    LLMEmptyResponseError,
)
from app.services.file_service import read_attachment_content, get_attachment_or_404
from app.services import memory_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat / Q&A"])


# ─────────────────────────── SSE 工具 ───────────────────────────────

def _sse_event(event: str, data: str | dict) -> str:
    payload = data if isinstance(data, str) else json.dumps(data, ensure_ascii=False)
    return f"event: {event}\ndata: {payload}\n\n"


# ─────────────────────────── 核心流式生成器 ─────────────────────────

async def _stream_ask(
    conv: Conversation,
    payload: ChatRequest,
    short_history: list,
    long_memories: list,
    file_contents: list,
    used_attachments: list[FileAttachment],
    db: Session,
) -> AsyncGenerator[str, None]:
    """
    SSE 生成器：
      metadata → delta × N → done

    异常处理层级：
      LLMTimeoutError      → error 事件（超时提示）
      LLMEmptyResponseError → error 事件（空响应提示）
      LLMUnavailableError  → error 事件（服务不可用提示）
      其他 Exception       → error 事件（兜底）

    出错时统一删除本次 assistant_msg 占位行，保持 DB 一致性。
    """
    # ── 1. 保存用户消息 ──
    user_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.USER,
        content=payload.question,
    )
    db.add(user_msg)
    db.flush()

    for att in used_attachments:
        att.message_id = user_msg.id

    # 创建 AI 消息占位
    assistant_msg = Message(
        conversation_id=conv.id,
        role=MessageRole.ASSISTANT,
        content="",
    )
    db.add(assistant_msg)
    db.flush()
    db.commit()

    # ── 2. metadata 事件 ──
    yield _sse_event("metadata", {
        "conversation_id": conv.id,
        "message_id": assistant_msg.id,
        "used_attachments": [
            FileAttachmentInfo.model_validate(a).model_dump(mode="json")
            for a in used_attachments
        ],
        "memory_active": len(long_memories) > 0,
    })

    # ── 3. 流式 delta ──
    full_answer: list[str] = []
    llm_error: str | None = None

    try:
        async for chunk in ask_llm_stream(
            history=short_history,
            question=payload.question,
            file_contents=file_contents or None,
            long_term_memories=long_memories or None,
        ):
            full_answer.append(chunk)
            yield _sse_event("delta", {"text": chunk})

    except LLMTimeoutError as exc:
        llm_error = f"AI 响应超时，请稍后重试。（{exc}）"
        logger.warning("LLMTimeoutError in stream: %s", exc)

    except LLMEmptyResponseError as exc:
        llm_error = "AI 未返回任何内容，请重试或换一种提问方式。"
        logger.warning("LLMEmptyResponseError in stream: %s", exc)

    except LLMUnavailableError as exc:
        llm_error = f"AI 服务暂时不可用，请稍后重试。（{exc}）"
        logger.error("LLMUnavailableError in stream: %s", exc)

    except asyncio.CancelledError:
        # 客户端断开连接，静默退出，清理 DB
        llm_error = "_cancelled_"
        logger.info("SSE stream cancelled by client (conv=%s)", conv.id)

    except Exception as exc:
        llm_error = f"AI 服务异常，请稍后重试。（{type(exc).__name__}）"
        logger.exception("Unexpected error in _stream_ask (conv=%s): %s", conv.id, exc)

    # ── 4. 出错处理：推送 error 事件 + 回滚 DB ──
    if llm_error is not None and llm_error != "_cancelled_":
        yield _sse_event("error", {"msg": llm_error})
        # 删除空的 assistant 占位，保持 DB 整洁
        try:
            db.delete(assistant_msg)
            db.commit()
        except Exception:
            pass
        return

    if llm_error == "_cancelled_":
        # 客户端断开：静默清理
        try:
            db.delete(assistant_msg)
            db.commit()
        except Exception:
            pass
        return

    # ── 5. 写回完整回复 ──
    answer_text = "".join(full_answer)
    assistant_msg.content = answer_text
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    yield _sse_event("done", {
        "message_id": assistant_msg.id,
        "conversation_id": conv.id,
    })

    # ── 6. 后台触发自动摘要（不阻塞流）──
    asyncio.create_task(
        memory_service.maybe_summarize(
            user_id=conv.user_id,
            conversation_id=conv.id,
            db_factory=SessionLocal,
        )
    )


# ─────────────────────────── Ask（流式 SSE）─────────────────────────

@router.post("/ask")
async def ask(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """提交问题，以 SSE 流式返回 AI 回答。集成短期滑动窗口 + 长期 RAG 记忆。"""

    # ── 1. 解析或创建会话 ──
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == current_user.id,
        ).first()
        if not conv:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")
    else:
        title = payload.question[:40] + ("…" if len(payload.question) > 40 else "")
        conv = Conversation(user_id=current_user.id, title=title)
        db.add(conv)
        db.flush()
        db.commit()

    # ── 2. 附件处理（仅 premium）──
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
            fc = read_attachment_content(att)
            file_contents.append(fc)
            used_attachments.append(att)

    # ── 3. 并发获取短期历史 + 长期记忆 ──
    # 设置超时保护，防止 RAG 检索慢时阻塞整个请求
    try:
        short_history, long_memories = await asyncio.wait_for(
            memory_service.get_full_context(
                user_id=current_user.id,
                conversation_id=conv.id,
                question=payload.question,
                db=db,
            ),
            timeout=10,  # 最多等 10 秒
        )
    except asyncio.TimeoutError:
        logger.warning("get_full_context timeout for conv=%s, using empty context", conv.id)
        short_history, long_memories = [], []

    # ── 4. 返回 SSE 流 ──
    return StreamingResponse(
        _stream_ask(conv, payload, short_history, long_memories,
                    file_contents, used_attachments, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
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


@router.patch("/conversations/{conv_id}/title")
def rename_conversation(
    conv_id: int,
    payload: ConversationRename,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """修改会话名称。"""
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="会话不存在")

    conv.title = payload.title
    db.commit()
    db.refresh(conv)
    return ok(ConversationOut.model_validate(conv).model_dump(mode="json"))


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
