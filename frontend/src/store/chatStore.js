import { create } from 'zustand'
import { chatApi } from '../api'

export const useChatStore = create((set, get) => ({
  conversations:       [],
  activeConversation:  null,  // 消息的全部内容
  activeId:            null,
  loading:             false,
  sending:             false,
  error:               null,

  // ── 加载对话列表 ──
  loadConversations: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await chatApi.listConversations()
      set({ conversations: data, loading: false })
    } catch (e) {
      set({ error: e.response?.data?.detail || '对话列表加载失败', loading: false })
    }
  },

  // ── 打开一个对话 ───
  openConversation: async (id) => {
    set({ loading: true, activeId: id, error: null })
    try {
      const { data } = await chatApi.getConversation(id)
      set({ activeConversation: data, loading: false })
    } catch (e) {
      set({ error: e.response?.data?.detail || '对话加载失败', loading: false })
    }
  },

  // ── 新建对话 ──
  newConversation: () => {
    set({ activeConversation: null, activeId: null })
  },

  // ── 发送消息 ───
  sendMessage: async ({ question, attachmentIds = [] }) => {
    const { activeId, activeConversation } = get()
    set({ sending: true, error: null })

    // Optimistically add user message to the view
    const optimisticUserMsg = {
      id: `opt-${Date.now()}`,
      role: 'user',
      content: question,
      created_at: new Date().toISOString(),
      attachments: [],
    }
    if (activeConversation) {
      set({
        activeConversation: {
          ...activeConversation,
          messages: [...activeConversation.messages, optimisticUserMsg],
        },
      })
    }

    try {
      const { data } = await chatApi.ask({
        conversation_id: activeId || null,
        question,
        attachment_ids: attachmentIds,
      })

      // Reload full conversation (ensures IDs are correct)
      const { data: conv } = await chatApi.getConversation(data.conversation_id)

      set((state) => ({
        sending: false,
        activeId: data.conversation_id,
        activeConversation: conv,
        // Prepend to sidebar if brand new
        conversations: state.conversations.find((c) => c.id === data.conversation_id)
          ? state.conversations.map((c) =>
              c.id === data.conversation_id
                ? { ...c, message_count: conv.message_count, updated_at: conv.updated_at }
                : c
            )
          : [{ id: conv.id, title: conv.title, created_at: conv.created_at, updated_at: conv.updated_at, message_count: conv.message_count }, ...state.conversations],
      }))

      return data
    } catch (e) {
      // Roll back optimistic message
      set((state) => ({
        sending: false,
        error: e.response?.data?.detail || 'Failed to send message',
        activeConversation: state.activeConversation
          ? {
              ...state.activeConversation,
              messages: state.activeConversation.messages.filter(
                (m) => m.id !== optimisticUserMsg.id
              ),
            }
          : null,
      }))
      throw e
    }
  },

  // ── Delete conversation ─────────────────────────────────────────
  deleteConversation: async (id) => {
    try {
      await chatApi.deleteConversation(id)
      set((state) => ({
        conversations: state.conversations.filter((c) => c.id !== id),
        activeConversation: state.activeId === id ? null : state.activeConversation,
        activeId: state.activeId === id ? null : state.activeId,
      }))
    } catch (e) {
      set({ error: e.response?.data?.detail || 'Failed to delete' })
    }
  },

  clearError: () => set({ error: null }),
}))
