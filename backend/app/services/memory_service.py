"""
memory_service.py — 双层记忆系统

短期记忆（Short-term Memory）
  - 滑动窗口：基于 token 预算动态裁剪历史消息
  - 中英混合 token 估算（无需外部 tokenizer）

长期记忆（Long-term Memory）
  - ChromaDB 持久化向量数据库
  - DashScope text-embedding-v1 做向量化（与 Qwen 同一供应商，中文效果好）
  - 触发时机：会话消息数每达到 SUMMARIZE_THRESHOLD 的倍数时，自动对旧消息摘要并入库
  - 检索时机：每次提问前，语义检索 Top-K 相关记忆注入 system prompt

错误处理改动：
  - get_embedding 增加 asyncio.wait_for 超时（10s）
  - maybe_summarize 捕获 LLMTimeoutError/LLMUnavailableError 并记录日志
  - get_full_context 内部 retrieve_memories 超时已由调用方（chat.py）保护
"""

from __future__ import annotations

import asyncio
import logging
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.models import Message, MemorySummary

logger = logging.getLogger(__name__)

# embedding 单次请求超时（秒）
EMBEDDING_TIMEOUT = 10


# ═══════════════════════════════════════════════════════════════════════
# 1. Token 估算（无需 tiktoken，基于字符特征快速计算）
# ═══════════════════════════════════════════════════════════════════════

def estimate_tokens(text: str) -> int:
    if not text:
        return 0
    total = len(text)
    cn = sum(1 for c in text if "\u4e00" <= c <= "\u9fff")
    en = total - cn
    return int(cn / 1.5 + en / 4.0) + 4


def _truncate_to_tokens(text: str, max_tokens: int) -> str:
    if estimate_tokens(text) <= max_tokens:
        return text
    ratio = max_tokens / estimate_tokens(text)
    cut = int(len(text) * ratio * 0.9)
    while estimate_tokens(text[:cut]) > max_tokens and cut > 0:
        cut = int(cut * 0.9)
    return text[:cut] + "…（内容过长已截断）"


# ═══════════════════════════════════════════════════════════════════════
# 2. 短期记忆：滑动窗口
# ═══════════════════════════════════════════════════════════════════════

def build_sliding_window(
    messages: List[Message],
    max_tokens: int = settings.MEMORY_SHORT_TERM_MAX_TOKENS,
) -> List[dict]:
    window: List[Message] = []
    used = 0

    for msg in reversed(messages):
        content = _truncate_to_tokens(msg.content, settings.MEMORY_MSG_MAX_TOKENS)
        cost = estimate_tokens(content)

        if used + cost > max_tokens and len(window) >= 2:
            break

        window.insert(0, msg)
        used += cost

    return [
        {"role": msg.role.value, "content": msg.content}
        for msg in window
    ]


# ═══════════════════════════════════════════════════════════════════════
# 3. DashScope 向量化（调用 OpenAI 兼容接口）
# ═══════════════════════════════════════════════════════════════════════

_embed_client: Optional[object] = None


def _get_embed_client():
    global _embed_client
    if _embed_client is None:
        if not settings.DASHSCOPE_API_KEY:
            return None
        from openai import AsyncOpenAI
        _embed_client = AsyncOpenAI(
            api_key=settings.DASHSCOPE_API_KEY,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
    return _embed_client


async def get_embedding(text: str) -> Optional[List[float]]:
    """
    调用 DashScope text-embedding-v1 返回向量。
    失败或超时时返回 None（长期记忆降级：跳过该操作）。
    """
    client = _get_embed_client()
    if client is None:
        return None
    try:
        text = _truncate_to_tokens(text, 1800)
        resp = await asyncio.wait_for(
            client.embeddings.create(
                model="text-embedding-v1",
                input=text,
            ),
            timeout=EMBEDDING_TIMEOUT,
        )
        return resp.data[0].embedding
    except asyncio.TimeoutError:
        logger.warning("get_embedding timed out after %ds", EMBEDDING_TIMEOUT)
        return None
    except Exception as e:
        logger.warning("get_embedding failed: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════════
# 4. ChromaDB 集合（懒加载，向量由 DashScope 提供）
# ═══════════════════════════════════════════════════════════════════════

_chroma_collection: Optional[object] = None


def get_chroma_collection():
    global _chroma_collection
    if _chroma_collection is not None:
        return _chroma_collection
    try:
        import chromadb
        client = chromadb.PersistentClient(path=settings.MEMORY_VECTOR_DB_PATH)
        _chroma_collection = client.get_or_create_collection(
            name="user_memories",
            metadata={"hnsw:space": "cosine"},
            embedding_function=None,
        )
        logger.info("ChromaDB collection 'user_memories' ready at %s",
                    settings.MEMORY_VECTOR_DB_PATH)
        return _chroma_collection
    except ImportError:
        logger.warning("chromadb not installed; long-term memory disabled. "
                       "Run: pip install chromadb")
        return None
    except Exception as e:
        logger.warning("ChromaDB init failed: %s", e)
        return None


# ═══════════════════════════════════════════════════════════════════════
# 5. 长期记忆：存储
# ═══════════════════════════════════════════════════════════════════════

async def store_memory(
    user_id: int,
    conversation_id: int,
    summary_text: str,
    last_message_id: int,
    db: Session,
) -> bool:
    collection = get_chroma_collection()
    if collection is None:
        return False

    embedding = await get_embedding(summary_text)
    if embedding is None:
        return False

    try:
        summary_record = MemorySummary(
            user_id=user_id,
            conversation_id=conversation_id,
            last_message_id=last_message_id,
            summary_text=summary_text,
        )
        db.add(summary_record)
        db.commit()
        db.refresh(summary_record)

        doc_id = f"mem_{summary_record.id}"
        collection.upsert(
            documents=[summary_text],
            embeddings=[embedding],
            metadatas=[{
                "user_id": str(user_id),
                "conversation_id": str(conversation_id),
                "summary_id": str(summary_record.id),
            }],
            ids=[doc_id],
        )
        logger.info("Long-term memory stored: %s (user=%s, conv=%s)",
                    doc_id, user_id, conversation_id)
        return True
    except Exception as e:
        logger.warning("store_memory failed: %s", e)
        return False


# ═══════════════════════════════════════════════════════════════════════
# 6. 长期记忆：检索
# ═══════════════════════════════════════════════════════════════════════

async def retrieve_memories(
    user_id: int,
    question: str,
    top_k: int = settings.MEMORY_RETRIEVAL_TOP_K,
) -> List[str]:
    """
    用问题向量检索该用户最相关的长期记忆摘要。
    失败或无记录时返回空列表（静默降级）。
    """
    collection = get_chroma_collection()
    if collection is None:
        return []

    try:
        count = collection.count()
        if count == 0:
            return []
    except Exception:
        return []

    embedding = await get_embedding(question)
    if embedding is None:
        return []

    try:
        results = collection.query(
            query_embeddings=[embedding],
            n_results=min(top_k, count),
            where={"user_id": str(user_id)},
            include=["documents", "distances"],
        )
        docs: List[str] = results.get("documents", [[]])[0]
        distances: List[float] = results.get("distances", [[]])[0]

        relevant = [
            doc for doc, dist in zip(docs, distances)
            if doc and dist < 0.6
        ]
        return relevant
    except Exception as e:
        logger.warning("retrieve_memories failed: %s", e)
        return []


# ═══════════════════════════════════════════════════════════════════════
# 7. 自动摘要（后台任务）
# ═══════════════════════════════════════════════════════════════════════

async def maybe_summarize(
    user_id: int,
    conversation_id: int,
    db_factory,
) -> None:
    """
    检查会话是否需要自动摘要并执行。
    - 每当真实消息数达到 SUMMARIZE_THRESHOLD 的整数倍时触发
    - 仅对尚未摘要的消息段落操作（通过 last_message_id 判断）
    - 使用独立 DB Session（后台任务中不复用请求 Session）
    - LLM 超时/不可用时记录警告并跳过，不影响主流程
    """
    from app.services.llm_service import ask_llm, LLMTimeoutError, LLMUnavailableError

    threshold = settings.MEMORY_SUMMARIZE_THRESHOLD
    if threshold <= 0:
        return

    db: Session = db_factory()
    try:
        messages: List[Message] = (
            db.query(Message)
            .filter(
                Message.conversation_id == conversation_id,
                Message.content != "[file upload placeholder]",
                Message.content != "",
            )
            .order_by(Message.created_at)
            .all()
        )

        total = len(messages)
        if total < threshold:
            return

        last_summary = (
            db.query(MemorySummary)
            .filter(MemorySummary.conversation_id == conversation_id)
            .order_by(MemorySummary.last_message_id.desc())
            .first()
        )
        last_summarized_id = last_summary.last_message_id if last_summary else 0

        unsummarized = [m for m in messages if m.id > last_summarized_id]
        if len(unsummarized) < threshold:
            return

        to_summarize = unsummarized[:threshold]
        last_msg_id = to_summarize[-1].id

        history_text = "\n".join(
            f"{'用户' if m.role.value == 'user' else 'AI'}: "
            f"{_truncate_to_tokens(m.content, 300)}"
            for m in to_summarize
        )
        summary_prompt = (
            "请用4-6句中文简洁总结以下对话的核心内容、用户关注点和关键结论：\n\n"
            f"{history_text}"
        )

        try:
            summary = await ask_llm(
                history=[],
                question=summary_prompt,
                max_tokens=settings.MEMORY_SUMMARY_MAX_TOKENS,
            )
        except LLMTimeoutError as exc:
            logger.warning("Auto-summarize skipped (timeout) for conv=%s: %s", conversation_id, exc)
            return
        except LLMUnavailableError as exc:
            logger.warning("Auto-summarize skipped (unavailable) for conv=%s: %s", conversation_id, exc)
            return
        except Exception as exc:
            logger.warning("Auto-summarize LLM call failed for conv=%s: %s", conversation_id, exc)
            return

        await store_memory(user_id, conversation_id, summary, last_msg_id, db)
        logger.info(
            "Auto-summarized conv=%s, messages %s..%s",
            conversation_id, to_summarize[0].id, last_msg_id
        )

    except Exception as e:
        logger.warning("maybe_summarize error: %s", e)
    finally:
        db.close()


# ═══════════════════════════════════════════════════════════════════════
# 8. 综合接口：一次调用获取完整上下文
# ═══════════════════════════════════════════════════════════════════════

async def get_full_context(
    user_id: int,
    conversation_id: int,
    question: str,
    db: Session,
) -> Tuple[List[dict], List[str]]:
    """
    同时返回：
      - short_history: 经过滑动窗口裁剪的短期历史（List[dict]）
      - long_memories: 语义检索到的长期记忆摘要（List[str]）

    两者并发执行以降低延迟。
    整体超时由调用方（chat.py asyncio.wait_for）兜底。
    """
    messages: List[Message] = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id,
            Message.content != "[file upload placeholder]",
            Message.content != "",
        )
        .order_by(Message.created_at)
        .all()
    )

    window = build_sliding_window(messages)
    memories = await retrieve_memories(user_id, question)

    return window, memories
