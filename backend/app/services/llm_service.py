from typing import List, Optional, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import settings

# 初始化 OpenAI 客户端（用于调用兼容 OpenAI 协议的 Qwen）
_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.DASHSCOPE_API_KEY:
            raise ValueError(
                "未设置 DASHSCOPE_API_KEY。"
                "请将其添加到你的 .env 文件中。"
            )
        _client = AsyncOpenAI(
            api_key=settings.DASHSCOPE_API_KEY,
            base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        )
    return _client


SYSTEM_PROMPT = """你是一个专业、友好的智能问答助手。
请根据用户的问题给出准确、清晰、有帮助的回答。
如果用户提供了附件内容，请结合附件内容回答问题。
回答时请使用中文，除非用户使用其他语言提问。"""


def build_messages_for_api(
    history: List[dict],
    question: str,
    file_contents: Optional[List[dict]] = None,
) -> List[dict]:
    """组装发送给 Qwen (OpenAI 格式) API 的消息列表。"""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)

    if file_contents:
        attachment_text = "\n\n".join(
            f"=== 附件: {fc['filename']} ===\n{fc['content']}"
            for fc in file_contents
        )
        user_content = (
            f"以下是用户上传的附件内容：\n\n{attachment_text}"
            f"\n\n---\n用户问题：{question}"
        )
    else:
        user_content = question

    messages.append({"role": "user", "content": user_content})
    return messages


async def ask_llm(
    history: List[dict],
    question: str,
    file_contents: Optional[List[dict]] = None,
    max_tokens: int = 2048,
) -> str:
    """调用 Qwen API 并以字符串形式返回 AI 助手的回复（非流式，保留备用）。"""
    client = _get_client()
    messages = build_messages_for_api(history, question, file_contents)

    response = await client.chat.completions.create(
        model="qwen-plus",
        max_tokens=max_tokens,
        messages=messages,
    )
    return response.choices[0].message.content


async def ask_llm_stream(
    history: List[dict],
    question: str,
    file_contents: Optional[List[dict]] = None,
    max_tokens: int = 2048,
) -> AsyncGenerator[str, None]:
    """
    调用 Qwen API 流式接口，逐 token yield 文本片段。
    调用方负责拼接完整回复并持久化。
    """
    client = _get_client()
    messages = build_messages_for_api(history, question, file_contents)

    stream = await client.chat.completions.create(
        model="qwen-plus",
        max_tokens=max_tokens,
        messages=messages,
        stream=True,
    )

    async for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content
