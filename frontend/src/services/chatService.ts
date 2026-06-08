/**
 * services/chatService.ts
 *
 * 会话与消息相关业务逻辑。
 * 支持流式 SSE 响应模式。
 *
 * 错误处理改动：
 * - sendMessageStream 增加 AbortController 超时自动取消（STREAM_TOTAL_TIMEOUT_MS）
 * - fetch 网络错误、AbortError 分类提示
 * - SSE 流读取中断时正确透传 onError
 * - onDone 回调 fetchConversation 失败时降级处理，不影响 UI
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

// 整体流式请求的客户端超时（毫秒）。
// 后端 STREAM_FIRST_CHUNK_TIMEOUT=30s + 模型最长响应约 120s，留 30s 余量。
const STREAM_TOTAL_TIMEOUT_MS = 180_000  // 3 分钟

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
  // 用户主动取消（AbortError）
  if (err instanceof DOMException && err.name === 'AbortError') {
    return '请求已取消'
  }
  if (err instanceof Error && err.name === 'AbortError') {
    return '请求超时，请稍后重试'
  }
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as Partial<ApiError>)?.msg
    if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
      return '请求超时，请稍后重试'
    }
    return msg ?? '操作失败，请重试'
  }
  if (err instanceof TypeError && err.message.includes('fetch')) {
    return '网络连接失败，请检查网络后重试'
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
 *
 * 新增：
 * - 内置客户端超时（STREAM_TOTAL_TIMEOUT_MS），超时后自动 abort 并回调 onError
 * - 外部传入 signal 可随时取消（例如用户切换会话）
 * - fetch 网络错误与 AbortError 分类提示
 * - SSE 读取循环内的异常统一 onError 处理
 */
export async function sendMessageStream(
  activeConversationId: number | null,
  params: SendMessageParams,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  const token = localStorage.getItem('token')

  // 合并：外部 signal + 客户端超时 signal
  const timeoutController = new AbortController()
  const timeoutId = setTimeout(
    () => timeoutController.abort(new Error('客户端超时')),
    STREAM_TOTAL_TIMEOUT_MS,
  )

  // 合并两个 signal：任意一个 abort 即触发
  const combinedSignal = signal
    ? AbortSignal.any
      ? AbortSignal.any([signal, timeoutController.signal])
      : timeoutController.signal  // 降级：不支持 AbortSignal.any 的旧浏览器
    : timeoutController.signal

  let response: Response
  try {
    response = await fetch('/api/v1/chat/ask', {
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
      signal: combinedSignal,
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      // 区分：超时 abort vs 外部主动 cancel
      if (timeoutController.signal.aborted) {
        callbacks.onError('请求超时（超过 3 分钟），请稍后重试')
      }
      // 外部取消时静默返回（用户主动操作，不显示错误）
      return
    }
    if (err instanceof TypeError) {
      callbacks.onError('网络连接失败，请检查网络后重试')
      return
    }
    callbacks.onError(err instanceof Error ? err.message : '请求失败，请重试')
    return
  }

  if (!response.ok) {
    clearTimeout(timeoutId)
    try {
      const errBody = await response.json()
      callbacks.onError(errBody?.detail ?? errBody?.msg ?? `请求失败 (${response.status})`)
    } catch {
      callbacks.onError(`请求失败 (${response.status})`)
    }
    return
  }

  if (!response.body) {
    clearTimeout(timeoutId)
    callbacks.onError('不支持流式响应')
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      let readResult: ReadableStreamReadResult<Uint8Array>
      try {
        readResult = await reader.read()
      } catch (readErr) {
        // 读取中断（网络断开、服务器关闭等）
        if (readErr instanceof DOMException && readErr.name === 'AbortError') {
          if (timeoutController.signal.aborted) {
            callbacks.onError('流式响应超时，请稍后重试')
          }
          // 外部取消静默退出
          return
        }
        callbacks.onError('数据读取中断，请刷新后重试')
        return
      }

      const { done, value } = readResult
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // SSE 以 "\n\n" 分隔每条消息
      const parts = buffer.split('\n\n')
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
              callbacks.onError(payload.msg ?? '服务端错误，请重试')
              break
          }
        } catch {
          // 忽略解析失败的 SSE 帧（不完整帧、心跳等）
        }
      }
    }
  } finally {
    clearTimeout(timeoutId)
    reader.releaseLock()
  }
}

export async function removeConversation(id: number): Promise<void> {
  await chatApi.deleteConversation(id)
}

export async function renameConversation(id: number, title: string): Promise<ConversationSummary> {
  const { data } = await chatApi.renameConversation(id, title)
  return data
}
