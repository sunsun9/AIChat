/**
 * store/chatStore.ts
 *
 * 聊天状态管理，支持流式 SSE 响应。
 *
 * 取消行为改动：
 * - cancelCurrentRequest 不再只清理状态，而是将流式消息转为普通消息保留在界面
 * - 有内容时追加"已停止生成"标记，无内容时才移除乐观消息
 * - 后端同步保存了已生成的部分内容，刷新后仍可读取
 */
import { create } from 'zustand'
import {
  fetchConversations,
  fetchConversation,
  sendMessageStream,
  removeConversation,
  renameConversation,
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
  _lastConvsLoaded: number
  _abortController: AbortController | null

  loadConversations: () => Promise<void>
  openConversation: (id: number) => Promise<void>
  newConversation: () => void
  sendMessage: (params: SendMessageParams) => Promise<void>
  cancelCurrentRequest: () => void
  deleteConversation: (id: number) => Promise<void>
  renameConversation: (id: number, title: string) => Promise<void>
  clearError: () => void
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

/**
 * 将消息列表中的流式/乐观消息转为普通消息（用于取消时保留内容）。
 * - 流式消息有内容：追加截断标记，转为 Message
 * - 流式消息无内容 / 乐观消息：移除
 */
function freezeStreamingMessages(
  messages: (Message | OptimisticMessage | StreamingMessage)[],
): (Message | OptimisticMessage | StreamingMessage)[] {
  return messages
    .map((m) => {
      if ('isStreaming' in m && m.isStreaming) {
        if (m.content.trim()) {
          // 有内容：去掉 isStreaming，保留为普通消息
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { isStreaming, ...rest } = m
          return {
            ...rest,
            id: Date.now(),
            content: m.content + '\n\n> *(已停止生成)*',
          } as Message
        }
        // 无内容：标记为需要删除
        return null
      }
      if ('isOptimistic' in m && m.isOptimistic) {
        // 乐观用户消息一并移除（没有对应的 AI 回复时不保留）
        // 但如果流式消息有内容，用户消息也应保留——通过下方 filter 判断
        return null
      }
      return m
    })
    .filter((m): m is Message | OptimisticMessage | StreamingMessage => {
      if (m === null) return false
      return true
    })
}

/**
 * 取消时：若流式消息有内容，同时保留前面的乐观用户消息（转为普通消息）。
 */
function freezeAllPendingMessages(
  messages: (Message | OptimisticMessage | StreamingMessage)[],
): (Message | OptimisticMessage | StreamingMessage)[] {
  // 判断流式消息是否有内容
  const streamingMsg = messages.find(
    (m): m is StreamingMessage => 'isStreaming' in m && (m as StreamingMessage).isStreaming,
  )
  const hasContent = !!streamingMsg?.content.trim()

  return messages
    .map((m) => {
      // 流式消息
      if ('isStreaming' in m && (m as StreamingMessage).isStreaming) {
        const sm = m as StreamingMessage
        if (sm.content.trim()) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { isStreaming, ...rest } = sm
          return {
            ...rest,
            id: Date.now(),
            content: sm.content + '\n\n> *(已停止生成)*',
          } as Message
        }
        return null // 无内容直接删除
      }
      // 乐观用户消息
      if ('isOptimistic' in m && (m as OptimisticMessage).isOptimistic) {
        if (hasContent) {
          // 流式有内容时保留用户消息
          const om = m as OptimisticMessage
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { isOptimistic, ...rest } = om
          return { ...rest, id: Date.now() - 1 } as Message
        }
        return null // 无内容时一并删除
      }
      return m
    })
    .filter((m): m is Message | OptimisticMessage | StreamingMessage => m !== null)
}

export const useChatStore = create<ChatStore>()((set, get) => ({
  conversations: [],
  activeConversation: null,
  activeId: null,
  loading: false,
  sending: false,
  error: null,
  _lastConvsLoaded: 0,
  _abortController: null,

  // ── 加载侧边栏列表 ───
  loadConversations: async () => {
    const { _lastConvsLoaded, loading } = get()
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
    get().cancelCurrentRequest()
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
    get().cancelCurrentRequest()
    set({ activeConversation: null, activeId: null })
  },

  // ── 主动取消当前流式请求 ──
  cancelCurrentRequest: () => {
    const { _abortController } = get()
    if (!_abortController) return

    _abortController.abort()

    // 将流式/乐观消息转为普通消息保留（而非直接清除）
    set((state) => ({
      sending: false,
      _abortController: null,
      activeConversation: state.activeConversation
        ? {
            ...state.activeConversation,
            messages: freezeAllPendingMessages(state.activeConversation.messages),
          }
        : null,
    }))
  },

  // ── 流式发送消息 ───
  sendMessage: async (params) => {
    get().cancelCurrentRequest()

    const { activeId, activeConversation } = get()
    const optimisticMsg = makeOptimisticMessage(params.question)
    const streamingMsg = makeStreamingMessage()

    const controller = new AbortController()
    set({ sending: true, error: null, _abortController: controller })

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
            id: -1,
            title: params.question.slice(0, 40),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: 0,
            messages: [optimisticMsg, streamingMsg],
          },
    })

    /** 统一回滚：移除乐观消息和流式占位（仅用于真正的错误） */
    const rollbackMessages = () => {
      set((state) => ({
        sending: false,
        _abortController: null,
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

    try {
      await sendMessageStream(
        activeId,
        params,
        {
          onMetadata: ({ conversation_id }) => {
            set((state) => ({
              activeId: conversation_id,
              activeConversation: state.activeConversation
                ? { ...state.activeConversation, id: conversation_id }
                : null,
            }))
          },

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

          onDone: async ({ conversation_id }) => {
            try {
              const conversation = await fetchConversation(conversation_id)
              set((state) => ({
                sending: false,
                _abortController: null,
                activeId: conversation_id,
                activeConversation: conversation,
                conversations: upsertConversationInList(state.conversations, conversation),
              }))
            } catch {
              // 拉取失败降级：把流式消息转为普通消息
              set((state) => {
                if (!state.activeConversation) return { sending: false, _abortController: null }
                return {
                  sending: false,
                  _abortController: null,
                  activeConversation: {
                    ...state.activeConversation,
                    messages: state.activeConversation.messages.map((m) => {
                      if ('isStreaming' in m && m.isStreaming) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { isStreaming, ...rest } = m
                        return { ...rest, id: Date.now() } as Message
                      }
                      if ('isOptimistic' in m && m.isOptimistic) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { isOptimistic, ...rest } = m
                        return { ...rest, id: Date.now() - 1 } as Message
                      }
                      return m
                    }),
                  },
                }
              })
            }
          },

          onError: (msg) => {
            set((state) => ({
              sending: false,
              _abortController: null,
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
        },
        controller.signal,
      )
    } catch (err) {
      const errMsg = extractChatError(err)
      if (errMsg === '请求已取消') {
        // 用户主动取消：freezeAllPendingMessages 已在 cancelCurrentRequest 中处理
        // 此处只确保 sending 状态被重置（双重保险）
        set({ sending: false, _abortController: null })
      } else {
        set({ error: errMsg })
        rollbackMessages()
      }
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

  // ── 重命名对话 ───
  renameConversation: async (id, title) => {
    try {
      const updated = await renameConversation(id, title)
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, title: updated.title } : c
        ),
        activeConversation:
          state.activeId === id && state.activeConversation
            ? { ...state.activeConversation, title: updated.title }
            : state.activeConversation,
      }))
    } catch (err) {
      set({ error: extractChatError(err) })
    }
  },

  clearError: () => set({ error: null }),

  resetChat: () => {
    get().cancelCurrentRequest()
    set({
      conversations: [],
      activeConversation: null,
      activeId: null,
      loading: false,
      sending: false,
      error: null,
      _lastConvsLoaded: 0,
      _abortController: null,
    })
  },
}))