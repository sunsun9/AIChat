/**
 * services/chatService.ts
 *
 * 会话与消息相关业务逻辑。
 * 支持流式 SSE 响应模式。
 */
import axios from 'axios'
import { chatApi } from '@/api'
import type {
  ConversationSummary,
  ConversationDetail,
  OptimisticMessage,
  SendMessageParams,
  ApiError,
} from '@/types'

// ── 辅助函数 ────

export function makeOptimisticMessage(question: string): OptimisticMessage {
  return {
    id: `opt-${Date.now()}`,
    role: 'user',
    content: question,
    created_at: new Date().toISOString(),
    attachments: [],
    isOptimistic: true,
  }
}

/** 从聊天错误中提取用户友好的提示信息。 */
export function extractChatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as Partial<ApiError>)?.msg
    return msg ?? '操作失败，请重试'
  }
  if (err instanceof Error) return err.message
  return '操作失败，请重试'
}

/**
 * 将会话摘要更新到列表中。
 * 若为新会话则插入到列表头部；若已存在则更新 message_count 和 updated_at。
 */
export function upsertConversationInList(
  list: ConversationSummary[],
  updated: ConversationDetail,
): ConversationSummary[] {
  const summary: ConversationSummary = {
    id: updated.id,
    title: updated.title,
    created_at: updated.created_at,
    updated_at: updated.updated_at,
    message_count: updated.message_count,
  }
  const exists = list.some((c) => c.id === updated.id)
  if (exists) {
    return list.map((c) => (c.id === updated.id ? summary : c))
  }
  return [summary, ...list]
}

// ── API 操作 ────

export async function fetchConversations(): Promise<ConversationSummary[]> {
  const { data } = await chatApi.listConversations()
  return data
}

export async function fetchConversation(id: number): Promise<ConversationDetail> {
  const { data } = await chatApi.getConversation(id)
  return data
}

export interface StreamCallbacks {
  /** 收到 metadata 事件（conversation_id 确定后立即触发） */
  onMetadata: (meta: { conversation_id: number; message_id: number }) => void
  /** 收到一个文本 delta */
  onDelta: (text: string) => void
  /** 流式完成 */
  onDone: (meta: { conversation_id: number; message_id: number }) => void
  /** 出错 */
  onError: (msg: string) => void
}

/**
 * 通过 fetch + ReadableStream 消费 SSE 流式聊天接口。
 * 不使用 EventSource，以便携带 Authorization header。
 */
export async function sendMessageStream(
  activeConversationId: number | null,
  params: SendMessageParams,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('token')

  const response = await fetch('/api/v1/chat/ask', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      conversation_id: activeConversationId,
      question: params.question,
      attachment_ids: params.attachmentIds ?? [],
    }),
    signal,
  })

  if (!response.ok) {
    // 尝试解析错误体
    try {
      const errBody = await response.json()
      callbacks.onError(errBody?.detail ?? errBody?.msg ?? `请求失败 (${response.status})`)
    } catch {
      callbacks.onError(`请求失败 (${response.status})`)
    }
    return
  }

  if (!response.body) {
    callbacks.onError('不支持流式响应')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE 以 "\n\n" 分隔每条消息
    const parts = buffer.split('\n\n')
    // 最后一段可能不完整，留在 buffer
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      if (!part.trim()) continue

      let eventType = 'message'
      let dataStr = ''

      for (const line of part.split('\n')) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          dataStr = line.slice(6).trim()
        }
      }

      if (!dataStr) continue

      try {
        const payload = JSON.parse(dataStr)
        switch (eventType) {
          case 'metadata':
            callbacks.onMetadata(payload)
            break
          case 'delta':
            callbacks.onDelta(payload.text ?? '')
            break
          case 'done':
            callbacks.onDone(payload)
            break
          case 'error':
            callbacks.onError(payload.msg ?? '未知错误')
            break
        }
      } catch {
        // 忽略解析失败的 SSE 帧
      }
    }
  }
}

export async function removeConversation(id: number): Promise<void> {
  await chatApi.deleteConversation(id)
}
