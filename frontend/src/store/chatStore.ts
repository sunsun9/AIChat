/**
 * store/chatStore.ts
 *
 * 聊天状态管理，支持流式 SSE 响应。
 *
 * 错误处理改动：
 * - sendMessage 持有 AbortController，新消息发送时自动取消上一个未完成的请求
 * - onDone 回调内 fetchConversation 失败时做优雅降级（保留流式内容，不显示错误）
 * - onError 回调在 sending=false 后才清理乐观消息，防止双重渲染
 * - 超时提示字符串由 chatService.extractChatError 统一处理
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
  _abortController: AbortController | null  // 当前流式请求的取消控制器

  loadConversations: () => Promise<void>
  openConversation: (id: number) => Promise<void>
  newConversation: () => void
  sendMessage: (params: SendMessageParams) => Promise<void>
  cancelCurrentRequest: () => void           // 主动取消当前流式请求
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
    // 切换会话时取消当前正在进行的流式请求
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
    if (_abortController) {
      _abortController.abort()
      set({ _abortController: null, sending: false })
    }
  },

  // ── 流式发送消息 ───
  sendMessage: async (params) => {
    // 如果有上一个未完成的请求，先取消
    get().cancelCurrentRequest()

    const { activeId, activeConversation } = get()
    const optimisticMsg = makeOptimisticMessage(params.question)
    const streamingMsg = makeStreamingMessage()

    // 创建新的取消控制器
    const controller = new AbortController()
    set({ sending: true, error: null, _abortController: controller })

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
            id: -1,
            title: params.question.slice(0, 40),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            message_count: 0,
            messages: [optimisticMsg, streamingMsg],
          },
    })

    /** 统一回滚：移除乐观消息和流式占位 */
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
          // metadata 到来：锁定 conversation_id
          onMetadata: ({ conversation_id }) => {
            set((state) => ({
              activeId: conversation_id,
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
                _abortController: null,
                activeId: conversation_id,
                activeConversation: conversation,
                conversations: upsertConversationInList(state.conversations, conversation),
              }))
            } catch {
              // 拉取失败时降级：把流式消息转为普通消息，保留已流式输出的内容
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

          // 出错：回滚乐观消息，显示错误提示
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
      // fetch 本身抛出异常（网络断开、AbortError 等）
      const errMsg = extractChatError(err)
      // 用户主动取消时不显示错误，只清理状态
      if (errMsg === '请求已取消') {
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
