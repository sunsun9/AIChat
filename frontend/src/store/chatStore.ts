/**
 * store/chatStore.ts
 *
 * 聊天状态管理。
 * 业务逻辑被委托给了 chatService.ts
 * 仅负责编排状态转换和乐观更新。
 */
import { create } from 'zustand'
import { fetchConversations, fetchConversation, sendMessage as serviceSendMessage, removeConversation, makeOptimisticMessage, upsertConversationInList, extractChatError } from '@/services/chatService'
import type { ConversationSummary, ConversationDetail, SendMessageParams, Message, OptimisticMessage } from '@/types'

interface ChatStore {
  conversations: ConversationSummary[]
  activeConversation: ConversationDetail | null
  activeId: number | null
  loading: boolean
  sending: boolean
  error: string | null

  loadConversations: () => Promise<void>
  openConversation: (id: number) => Promise<void>
  newConversation: () => void
  sendMessage: (params: SendMessageParams) => Promise<void>
  deleteConversation: (id: number) => Promise<void>
  clearError: () => void
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeConversation: null,
  activeId: null,
  loading: false,
  sending: false,
  error: null,

  // ── 加载侧边栏列表 ───
  loadConversations: async () => {
    set({ loading: true, error: null })
    try {
      const conversations = await fetchConversations()
      set({ conversations, loading: false })
    } catch (err) {
      set({ error: extractChatError(err), loading: false })
    }
  },

  // ── 打开一个对话 ──
  openConversation: async (id) => {
    set({ loading: true, activeId: id, error: null })
    try {
      const conversation = await fetchConversation(id)
      set({ activeConversation: conversation, loading: false })
    } catch (err) {
      set({ error: extractChatError(err), loading: false })
    }
  },

  // ── 开启一个全新的空白对话 ───
  newConversation: () => {
    set({ activeConversation: null, activeId: null })
  },

  // ── 发送消息并进行乐观更新 ───
  sendMessage: async (params) => {
    const { activeId, activeConversation } = get()
    const optimisticMsg = makeOptimisticMessage(params.question)

    set({ sending: true, error: null })

    // 乐观地追加用户消息
    if (activeConversation) {
      set({
        activeConversation: {
          ...activeConversation,
          messages: [
            ...(activeConversation.messages as (Message | OptimisticMessage)[]),
            optimisticMsg,
          ],
        },
      })
    }

    try {
      const { conversationId, conversation } = await serviceSendMessage(activeId, params)

      set((state) => ({
        sending: false,
        activeId: conversationId,
        activeConversation: conversation,
        conversations: upsertConversationInList(state.conversations, conversation),
      }))
    } catch (err) {
      // 失败时回滚（移除）乐观消息
      set((state) => ({
        sending: false,
        error: extractChatError(err),
        activeConversation: state.activeConversation
          ? {
              ...state.activeConversation,
              messages: state.activeConversation.messages.filter(
                (m) => m.id !== optimisticMsg.id,
              ),
            }
          : null,
      }))
    }
  },

  // ── 删除对话 ───
  deleteConversation: async (id) => {
    try {
      await removeConversation(id)
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversation: state.activeId === id ? null : state.activeConversation,
        activeId: state.activeId === id ? null : state.activeId,
      }))
    } catch (err) {
      set({ error: extractChatError(err) })
    }
  },

  clearError: () => set({ error: null }),
}))