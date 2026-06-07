/**
 * store/chatStore.ts
 *
 * 聊天状态管理，支持流式 SSE 响应。
 */
import { create } from 'zustand'
import {
  fetchConversations,
  fetchConversation,
  sendMessageStream,
  removeConversation,
  makeOptimisticMessage,
  upsertConversationInList,
  extractChatError,
} from '@/services/chatService'
import type {
  ConversationSummary,
  ConversationDetail,
  SendMessageParams,
  Message,
  OptimisticMessage,
  StreamingMessage,
} from '@/types'

interface ChatStore {
  conversations: ConversationSummary[]
  activeConversation: ConversationDetail | null
  activeId: number | null
  loading: boolean
  sending: boolean
  error: string | null
  _lastConvsLoaded: number  // timestamp，节流防重复请求

  loadConversations: () => Promise<void>
  openConversation: (id: number) => Promise<void>
  newConversation: () => void
  sendMessage: (params: SendMessageParams) => Promise<void>
  deleteConversation: (id: number) => Promise<void>
  clearError: () => void
  /** 切换用户时清空所有聊天状态，同时重置节流时间戳 */
  resetChat: () => void
}

/** 生成流式消息占位 */
function makeStreamingMessage(): StreamingMessage {
  return {
    id: `streaming-${Date.now()}`,
    role: 'assistant',
    content: '',
    created_at: new Date().toISOString(),
    attachments: [],
    isStreaming: true,
  }
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeConversation: null,
  activeId: null,
  loading: false,
  sending: false,
  error: null,
  _lastConvsLoaded: 0,

  // ── 加载侧边栏列表 ───
  loadConversations: async () => {
    const { _lastConvsLoaded, loading } = get()
    // 30 秒内不重复请求（App 预取 + Sidebar 挂载双触发保护）
    if (loading || Date.now() - _lastConvsLoaded < 30_000) return
    set({ loading: true, error: null })
    try {
      const conversations = await fetchConversations()
      set({ conversations, loading: false, _lastConvsLoaded: Date.now() })
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

  // ── 流式发送消息 ───
  sendMessage: async (params) => {
    const { activeId, activeConversation } = get()
    const optimisticMsg = makeOptimisticMessage(params.question)
    const streamingMsg = makeStreamingMessage()

    set({ sending: true, error: null })

    // 1. 乐观追加用户消息 + 流式占位消息
    const baseMessages = activeConversation?.messages ?? []
    set({
      activeConversation: activeConversation
        ? {
            ...activeConversation,
            messages: [
              ...(baseMessages as (Message | OptimisticMessage | StreamingMessage)[]),
              optimisticMsg,
              streamingMsg,
            ],
          }
        : {
            // 新对话：先用占位数据，等 metadata 到来后替换
            id: -1,
            title: params.question.slice(0, 40),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: 0,
            messages: [optimisticMsg, streamingMsg],
          },
    })

    let confirmedConvId: number | null = null

    try {
      await sendMessageStream(activeId, params, {
        // metadata 到来：锁定 conversation_id
        onMetadata: ({ conversation_id }) => {
          confirmedConvId = conversation_id
          set((state) => ({
            activeId: conversation_id,
            // 若是新对话，把临时 id -1 替换为真实 id
            activeConversation: state.activeConversation
              ? { ...state.activeConversation, id: conversation_id }
              : null,
          }))
        },

        // delta 到来：追加文本到流式气泡
        onDelta: (text) => {
          set((state) => {
            if (!state.activeConversation) return {}
            return {
              activeConversation: {
                ...state.activeConversation,
                messages: state.activeConversation.messages.map((m) =>
                  'isStreaming' in m && m.isStreaming
                    ? { ...m, content: m.content + text }
                    : m,
                ),
              },
            }
          })
        },

        // 流完成：拉取最新完整数据，替换流式占位
        onDone: async ({ conversation_id }) => {
          try {
            const conversation = await fetchConversation(conversation_id)
            set((state) => ({
              sending: false,
              activeId: conversation_id,
              activeConversation: conversation,
              conversations: upsertConversationInList(state.conversations, conversation),
            }))
          } catch {
            // 拉取失败时直接把流式消息标记为正常消息（降级处理）
            set((state) => {
              if (!state.activeConversation) return { sending: false }
              return {
                sending: false,
                activeConversation: {
                  ...state.activeConversation,
                  messages: state.activeConversation.messages.map((m) => {
                    if ('isStreaming' in m && m.isStreaming) {
                      // eslint-disable-next-line @typescript-eslint/no-unused-vars
                      const { isStreaming, ...rest } = m
                      return { ...rest, id: Date.now() } as Message
                    }
                    return m
                  }),
                },
              }
            })
          }
        },

        // 出错：回滚乐观消息
        onError: (msg) => {
          set((state) => ({
            sending: false,
            error: msg,
            activeConversation: state.activeConversation
              ? {
                  ...state.activeConversation,
                  messages: state.activeConversation.messages.filter(
                    (m) =>
                      !('isOptimistic' in m && m.isOptimistic) &&
                      !('isStreaming' in m && m.isStreaming),
                  ),
                }
              : null,
          }))
        },
      })
    } catch (err) {
      // fetch 本身抛出异常（网络断开等）
      set((state) => ({
        sending: false,
        error: extractChatError(err),
        activeConversation: state.activeConversation
          ? {
              ...state.activeConversation,
              messages: state.activeConversation.messages.filter(
                (m) =>
                  !('isOptimistic' in m && m.isOptimistic) &&
                  !('isStreaming' in m && m.isStreaming),
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

  resetChat: () =>
    set({
      conversations: [],
      activeConversation: null,
      activeId: null,
      loading: false,
      sending: false,
      error: null,
      _lastConvsLoaded: 0,   // 重置节流，让新用户登录后能立即拉取自己的数据
    }),
}))