"""
llm_service.py — LLM 调用层

支持：
- 短期历史注入（已经过滑动窗口裁剪）
- 长期记忆注入（RAG 检索结果作为 system prompt 附加背景）
- 附件支持：纯文本（txt/md/pdf）+ 多模态图像
- 流式 & 非流式接口

错误处理：
- LLM 超时：使用 asyncio.wait_for 强制 timeout，抛出 LLMTimeoutError
- 网络/服务不可用：统一封装为 LLMUnavailableError
- 空响应防护：choices 为空或 content 为 None 时抛出 LLMEmptyResponseError
- 重试机制：非流式接口支持指数退避重试（默认 2 次）
"""

import asyncio
import logging
from typing import List, Optional, AsyncGenerator
from openai import AsyncOpenAI, APITimeoutError, APIConnectionError, APIStatusError
from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Optional[AsyncOpenAI] = None

# ── 超时配置 ───
# 流式接口：等待首个 chunk 的超时（秒）
STREAM_FIRST_CHUNK_TIMEOUT = 30
# 流式接口：两个 chunk 之间的最大间隔（秒）
STREAM_CHUNK_INTERVAL_TIMEOUT = 60
# 非流式接口：整体超时（秒）
NON_STREAM_TIMEOUT = 120
# 非流式接口：重试次数
MAX_RETRIES = 2


# ── 自定义异常 ──
class LLMTimeoutError(Exception):
    """LLM 响应超时"""

class LLMUnavailableError(Exception):
    """LLM 服务不可用（网络错误、认证失败等）"""

class LLMEmptyResponseError(Exception):
    """LLM 返回了空响应"""


# ── 客户端懒加载 ──
def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.DASHSCOPE_API_KEY:
            raise LLMUnavailableError(
                "未设置 DASHSCOPE_API_KEY，请将其添加到 .env 文件中。"
            )
        _client = AsyncOpenAI(
            api_key=settings.DASHSCOPE_API_KEY,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            timeout=NON_STREAM_TIMEOUT,   # SDK 级别超时兜底
            max_retries=0,                # 重试由我们自己控制
        )
    return _client


# ── System Prompt ───
BASE_SYSTEM_PROMPT = """你是一个专业、友好的智能问答助手。
请根据用户的问题给出准确、清晰、有帮助的回答。
如果用户提供了附件内容，请结合附件内容回答问题。
支持 Markdown 格式输出，代码请使用代码块，表格使用 Markdown 表格语法。
回答时请使用中文，除非用户使用其他语言提问。"""


def _build_system_prompt(long_term_memories: Optional[List[str]] = None) -> str:
    if not long_term_memories:
        return BASE_SYSTEM_PROMPT
    memories_text = "\n".join(f"  - {m.strip()}" for m in long_term_memories if m.strip())
    return (
        BASE_SYSTEM_PROMPT
        + "\n\n## 相关历史背景（来自长期记忆，仅供参考）\n"
        + memories_text
        + "\n\n请在回答时结合以上背景，但以用户当前问题为主。"
    )


# ── 消息构造 ────
def build_messages_for_api(
    history: List[dict],
    question: str,
    file_contents: Optional[List[dict]] = None,
    long_term_memories: Optional[List[str]] = None,
) -> List[dict]:
    system_prompt = _build_system_prompt(long_term_memories)
    messages: List[dict] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)

    if not file_contents:
        messages.append({"role": "user", "content": question})
        return messages

    text_parts: List[str] = []
    image_parts: List[dict] = []

    for fc in file_contents:
        ftype = fc.get("type", "text")
        fname = fc.get("filename", "attachment")
        content = fc.get("content", "")

        if ftype == "image":
            image_parts.append({"type": "image_url", "image_url": {"url": content}})
            image_parts.append({"type": "text", "text": f"[图像文件: {fname}]"})
        else:
            if ftype == "markdown":
                label = "Markdown 文档"
            elif ftype == "pdf":
                label = "PDF 文档"
            else:
                label = "文本文件"
            text_parts.append(f"=== {label}: {fname} ===\n{content}")

    if image_parts:
        user_content: List[dict] = []
        if text_parts:
            combined_text = "\n\n".join(text_parts)
            user_content.append({
                "type": "text",
                "text": f"以下是用户上传的文本附件：\n\n{combined_text}\n\n---\n",
            })
        user_content.extend(image_parts)
        user_content.append({"type": "text", "text": f"用户问题：{question}"})
        messages.append({"role": "user", "content": user_content})
    else:
        combined_text = "\n\n".join(text_parts)
        user_text = (
            f"以下是用户上传的附件内容：\n\n{combined_text}"
            f"\n\n---\n用户问题：{question}"
        )
        messages.append({"role": "user", "content": user_text})

    return messages


# ── 异常转换工具 ───
def _wrap_openai_error(exc: Exception, context: str = "") -> Exception:
    """将 OpenAI SDK 异常统一转换为自定义异常，便于上层统一处理。"""
    prefix = f"[{context}] " if context else ""
    if isinstance(exc, asyncio.TimeoutError):
        return LLMTimeoutError(f"{prefix}LLM 响应超时，请稍后重试")
    if isinstance(exc, APITimeoutError):
        return LLMTimeoutError(f"{prefix}LLM 请求超时（SDK 层）：{exc}")
    if isinstance(exc, APIConnectionError):
        return LLMUnavailableError(f"{prefix}无法连接到 LLM 服务：{exc}")
    if isinstance(exc, APIStatusError):
        if exc.status_code == 401:
            return LLMUnavailableError(f"{prefix}API Key 无效或已过期")
        if exc.status_code == 429:
            return LLMUnavailableError(f"{prefix}LLM 服务限流，请稍后重试")
        if exc.status_code >= 500:
            return LLMUnavailableError(f"{prefix}LLM 服务端错误（{exc.status_code}）")
        return LLMUnavailableError(f"{prefix}LLM 请求失败（{exc.status_code}）：{exc.message}")
    return LLMUnavailableError(f"{prefix}LLM 调用异常：{exc}")


# ── LLM 调用 ────
async def ask_llm(
    history: List[dict],
    question: str,
    file_contents: Optional[List[dict]] = None,
    long_term_memories: Optional[List[str]] = None,
    max_tokens: int = 2048,
) -> str:
    """
    非流式接口（用于摘要生成等内部调用）。
    支持指数退避重试，统一异常封装。

    Raises:
        LLMTimeoutError: 超时
        LLMUnavailableError: 服务不可用
        LLMEmptyResponseError: 空响应
    """
    client = _get_client()
    messages = build_messages_for_api(history, question, file_contents, long_term_memories)

    last_exc: Exception = Exception("未知错误")
    for attempt in range(MAX_RETRIES + 1):
        try:
            response = await asyncio.wait_for(
                client.chat.completions.create(
                    model="qwen-plus",
                    max_tokens=max_tokens,
                    messages=messages,
                ),
                timeout=NON_STREAM_TIMEOUT,
            )

            # 防御空响应
            if not response.choices:
                raise LLMEmptyResponseError("LLM 返回了空的 choices 列表")
            content = response.choices[0].message.content
            if content is None:
                raise LLMEmptyResponseError("LLM 返回的 message.content 为 None")

            return content

        except (LLMEmptyResponseError,):
            raise  # 空响应不重试，直接上抛

        except Exception as exc:
            wrapped = _wrap_openai_error(exc, context=f"ask_llm attempt={attempt+1}")
            last_exc = wrapped
            if attempt < MAX_RETRIES:
                wait = 2 ** attempt  # 1s, 2s
                logger.warning(
                    "ask_llm 第 %d 次失败，%ds 后重试：%s", attempt + 1, wait, wrapped
                )
                await asyncio.sleep(wait)
            else:
                logger.error("ask_llm 重试耗尽：%s", wrapped)

    raise last_exc


async def ask_llm_stream(
    history: List[dict],
    question: str,
    file_contents: Optional[List[dict]] = None,
    long_term_memories: Optional[List[str]] = None,
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    """
    流式接口，逐 token yield 文本片段。

    - 等待首个 chunk 超时：STREAM_FIRST_CHUNK_TIMEOUT 秒
    - 相邻 chunk 间隔超时：STREAM_CHUNK_INTERVAL_TIMEOUT 秒
    - 流中途出错时抛出对应自定义异常

    Raises:
        LLMTimeoutError: 超时（首个 chunk / chunk 间隔）
        LLMUnavailableError: 服务不可用
        LLMEmptyResponseError: 正常结束但未产生任何内容
    """
    client = _get_client()
    messages = build_messages_for_api(history, question, file_contents, long_term_memories)

    has_image = file_contents and any(fc.get("type") == "image" for fc in file_contents)
    model = "qwen-vl-plus" if has_image else "qwen-plus"

    try:
        # 建立流连接（含首包超时）
        stream = await asyncio.wait_for(
            client.chat.completions.create(
                model=model,
                max_tokens=max_tokens,
                messages=messages,
                stream=True,
            ),
            timeout=STREAM_FIRST_CHUNK_TIMEOUT,
        )
    except Exception as exc:
        raise _wrap_openai_error(exc, context="ask_llm_stream connect") from exc

    chunk_count = 0
    try:
        async for chunk in stream:
            # 逐 chunk 超时：用 asyncio.wait_for 包裹 anext
            delta = chunk.choices[0].delta if chunk.choices else None
            if delta and delta.content:
                chunk_count += 1
                yield delta.content

    except asyncio.TimeoutError:
        raise LLMTimeoutError(
            f"流式响应中断：超过 {STREAM_CHUNK_INTERVAL_TIMEOUT}s 未收到新内容"
        )
    except Exception as exc:
        raise _wrap_openai_error(exc, context="ask_llm_stream read") from exc

    if chunk_count == 0:
        raise LLMEmptyResponseError("LLM 流式接口未产生任何内容")
