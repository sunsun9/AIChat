"""
大语言模型服务 (LLM Service) – 封装 Anthropic Messages API。

支持功能：
- 纯文本问答
- 结合 TXT 文件内容的问答（仅限高级会员用户）
"""

from typing import List, Optional
import anthropic
from app.core.config import settings

# 初始化 Anthropic 客户端
_client: Optional[anthropic.AsyncAnthropic] = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
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
    """
    组装发送给 Anthropic API 的消息列表。

    参数:
        history:       包含 {"role": "user"|"assistant", "content": str} 的列表，
                       代表之前的对话上下文（最旧的在前，最新的在后）。
        question:      当前用户提出的问题。
        file_contents: 可选参数，包含 {"filename": str, "content": str} 的列表，
                       用于存储高级会员上传的附件。

    返回:
        一个准备好传递给 client.messages.create() 的消息字典列表。
    """
    messages = list(history)  # 浅拷贝，防止修改调用者传入的原始列表

    # 构建当前用户回合的消息
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
    """
    调用 Anthropic API 并以字符串形式返回 AI 助手的回复。

    异常处理:
        API 请求失败时抛出 anthropic.APIError。
        如果没有配置 ANTHROPIC_API_KEY，则抛出 ValueError。
    """
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError(
            "未设置 ANTHROPIC_API_KEY。"
            "请将其添加到你的 .env 文件中。"
        )

    client = _get_client()
    messages = build_messages_for_api(history, question, file_contents)

    response = await client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=max_tokens,
        system=SYSTEM_PROMPT,
        messages=messages,
    )

    # 从返回体的第一个内容块中提取纯文本结果
    return response.content[0].text
