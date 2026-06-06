/**
 * services/chatService.ts
 *
 * 会话与消息相关业务逻辑。
 * 负责乐观消息 ID 的生成、会话列表的局部更新及 API 调用编排。
 * 纯函数，不引入 Zustand。
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
    // 新统一错误格式：{ code, msg, data: null }
    const msg = (err.response?.data as Partial<ApiError>)?.msg
    return msg ?? '操作失败，请重试'
  }
  if (err instanceof Error) return err.message
  return '操作失败，请重试'
}

/**
 * 将会话摘要更新到列表中。
 * 若为新会话则插入到列表头部；
 * 若已存在则更新 message_count 和 updated_at。
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

export interface SendResult {
  conversationId: number
  conversation: ConversationDetail
}

/**
 * 发送消息并返回刷新后的会话数据。
 * 乐观 UI 更新由调用方负责。
 */
export async function sendMessage(
  activeConversationId: number | null,
  params: SendMessageParams,
): Promise<SendResult> {
  const { data: askData } = await chatApi.ask({
    conversation_id: activeConversationId,
    question: params.question,
    attachment_ids: params.attachmentIds ?? [],
  })

  const conversation = await fetchConversation(askData.conversation_id)

  return { conversationId: askData.conversation_id, conversation }
}

export async function removeConversation(id: number): Promise<void> {
  await chatApi.deleteConversation(id)
}