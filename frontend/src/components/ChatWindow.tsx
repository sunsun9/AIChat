import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import MessageBubble from './MessageBubble'
import { Bot, MessageSquare } from 'lucide-react'
import type { Message } from '@/types'

// ── 子组件 ────
function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-up">
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center bg-amber/10 border border-amber/25 shadow-amber-glow">
        <Bot size={13} className="text-amber" />
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-carbon-50 border border-carbon-300">
        <div className="flex gap-1 items-center h-4">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  )
}

const SUGGESTED_PROMPTS = [
  '✦ 解释量子纠缠的原理',
  '✦ 帮我优化这段 Python 代码',
  '✦ 写一篇关于AI的短文',
]

function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center space-y-4 animate-fade-up max-w-sm px-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber/8 border border-amber/20 flex items-center justify-center shadow-amber-glow">
          <MessageSquare size={28} className="text-amber" />
        </div>
        <div>
          <h2 className="font-display font-bold text-ice text-xl mb-2">开始对话</h2>
          <p className="text-slate-soft text-sm leading-relaxed">
            在下方输入您的问题，即可与 AI 助手展开对话。
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 text-left">
          {SUGGESTED_PROMPTS.map((tip) => (
            <div
              key={tip}
              className="px-3 py-2 rounded-lg bg-carbon-200 border border-carbon-300 text-xs text-slate-soft font-mono"
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
      <div className="flex gap-1.5">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
    </div>
  )
}

// ── 主组件 ────
/** 从消息列表中过滤掉文件上传的占位符消息。 */
function useVisibleMessages() {
  const activeConversation = useChatStore((s) => s.activeConversation)
  return (activeConversation?.messages ?? []).filter(
    (m): m is Message => m.content !== '[file upload placeholder]',
  )
}

export default function ChatWindow() {
  const { activeConversation, sending, loading } = useChatStore()
  const messages = useVisibleMessages()
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, sending])

  if (loading && !activeConversation) return <LoadingState />
  if (!activeConversation || messages.length === 0) return <EmptyState />

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      {sending && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}