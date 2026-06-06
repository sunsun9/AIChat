/**
 * services/chatService.ts
 *
 * 对话和消息的业务逻辑。
 * 处理乐观消息 ID、对话列表更新（patching）以及 API 编排。
 * 纯函数 — 不引入 Zustand。
 */
import axios from 'axios'
import { chatApi } from '@/api'
import type {
  ConversationSummary,
  ConversationDetail,
  OptimisticMessage,
  SendMessageParams,
} from '@/types'

// ── 辅助函数 ──
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

export function extractChatError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string })?.detail
    return detail ?? '操作失败，请重试'
  }
  return '操作失败，请重试'
}

/**
 * 在现有列表中插入或更新对话摘要 (Upsert)。
 * 如果是新对话，则将其添加到列表头部。
 * 如果对话已存在，则更新 message_count 和 updated_at。
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

// ── API 操作 ───
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
 * 发送消息并返回刷新后的对话。
 * 调用者负责处理乐观的 UI 更新。
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