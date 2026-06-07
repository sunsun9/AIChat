from typing import List, Optional, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import settings

# 初始化 OpenAI 客户端（调用兼容 OpenAI 协议的 Qwen）
_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not settings.DASHSCOPE_API_KEY:
            raise ValueError(
                "未设置 DASHSCOPE_API_KEY，请将其添加到 .env 文件中。"
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
    """
    组装发送给 Qwen (OpenAI 格式) API 的消息列表。

    file_contents 每项格式：
      {"type": "text"|"pdf"|"image", "content": str, "filename": str}

    - text/pdf → 拼入纯文本上下文
    - image    → 使用 vision 多模态格式（image_url + data URI）
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history)

    if not file_contents:
        messages.append({"role": "user", "content": question})
        return messages

    # 分拣：文本类 vs 图像类
    text_parts: List[str] = []
    image_parts: List[dict] = []   # OpenAI vision image_url 块

    for fc in file_contents:
        ftype = fc.get("type", "text")
        fname = fc.get("filename", "attachment")
        content = fc.get("content", "")

        if ftype == "image":
            # vision 格式
            image_parts.append({
                "type": "image_url",
                "image_url": {"url": content},
            })
            image_parts.append({
                "type": "text",
                "text": f"[图像文件: {fname}]",
            })
        else:
            label = "PDF" if ftype == "pdf" else "文本文件"
            text_parts.append(f"=== {label}: {fname} ===\n{content}")

    # 构建用户消息内容
    if image_parts:
        # 有图像 → 使用多模态内容数组
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
        # 纯文本附件
        combined_text = "\n\n".join(text_parts)
        user_text = (
            f"以下是用户上传的附件内容：\n\n{combined_text}"
            f"\n\n---\n用户问题：{question}"
        )
        messages.append({"role": "user", "content": user_text})

    return messages


async def ask_llm(
    history: List[dict],
    question: str,
    file_contents: Optional[List[dict]] = None,
    max_tokens: int = 2048,
) -> str:
    """调用 Qwen API 返回完整回复（非流式，备用）。"""
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
    """调用 Qwen API 流式接口，逐 token yield 文本片段。"""
    client = _get_client()
    messages = build_messages_for_api(history, question, file_contents)

    # 有图像时切换为支持 vision 的模型
    # has_image = file_contents and any(fc.get("type") == "image" for fc in file_contents)
    # model = "qwen-vl-plus" if has_image else "qwen3.6-plus"
    model = "qwen3.6-plus"

    stream = await client.chat.completions.create(
        model=model,
        max_tokens=max_tokens,
        messages=messages,
        stream=True,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if delta and delta.content:
            yield delta.content
