import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import MessageBubble from './MessageBubble'
import { Bot, MessageSquare } from 'lucide-react'
import type { Message, StreamingMessage, OptimisticMessage } from '@/types'

const SUGGESTED_PROMPTS = [
  '✦ 解释量子纠缠的原理',
  '✦ 帮我优化这段 Python 代码',
  '✦ 写一篇关于AI的短文',
]

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-up max-w-sm px-6">
        <div
          className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center"
          style={{
            background: 'var(--accent-dim)',
            border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
            boxShadow: '0 0 24px var(--accent-dim)',
          }}
        >
          <MessageSquare size={28} style={{ color: 'var(--accent)' }} />
        </div>
        <div>
          <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--text-main)' }}>
            开始对话
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-soft)' }}>
            在下方输入您的问题，即可与 AI 助手展开对话。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 text-left">
          {SUGGESTED_PROMPTS.map((tip) => (
            <div
              key={tip}
              className="px-3 py-2 rounded-lg text-xs font-mono"
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--bg-border)',
                color: 'var(--text-soft)',
              }}
            >
              {tip}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: 'var(--accent-dim)' }}
      >
        <Bot size={16} style={{ color: 'var(--accent)' }} className="animate-pulse" />
      </div>
    </div>
  )
}

type AnyMessage = Message | OptimisticMessage | StreamingMessage

function useVisibleMessages(): AnyMessage[] {
  const activeConversation = useChatStore((s) => s.activeConversation)
  return (activeConversation?.messages ?? []).filter(
    (m): m is AnyMessage => m.content !== '[file upload placeholder]',
  )
}

export default function ChatWindow() {
  const { activeConversation, sending, loading } = useChatStore()
  const messages = useVisibleMessages()
  const bottomRef = useRef<HTMLDivElement>(null)

  // 有新消息或流式内容更新时自动滚到底
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, sending])

  // 流式输出时跟随滚动（依赖最后一条消息内容）
  const lastMsgContent = messages[messages.length - 1]?.content ?? ''
  useEffect(() => {
    if (sending) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lastMsgContent, sending])

  if (loading && !activeConversation) return <LoadingState />
  if (!activeConversation || messages.length === 0) return <EmptyState />

  return (
    <div className="flex-1 overflow-y-auto py-6">
      <div className="mx-auto w-full px-6 space-y-5" style={{ maxWidth: '720px' }}>
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
