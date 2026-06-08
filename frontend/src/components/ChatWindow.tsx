import { useEffect, useRef, useCallback, useState } from 'react'
import { useChatStore } from '@/store/chatStore'
import MessageBubble from './MessageBubble'
import { Bot, MessageSquare, ChevronDown } from 'lucide-react'
import type { Message, StreamingMessage, OptimisticMessage } from '@/types'

const SUGGESTED_PROMPTS = [
  '解释量子纠缠的原理',
  '帮我优化这段 Python 代码',
  '写一篇关于AI的短文',
]

function EmptyState() {
  const { sendMessage, sending } = useChatStore()

  const handlePromptClick = (text: string) => {
    if (sending) return
    void sendMessage({ question: text })
  }

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
          {SUGGESTED_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => handlePromptClick(prompt)}
              disabled={sending}
              className="w-full px-4 py-3 rounded-xl text-left transition-all duration-200 active:scale-[0.97]"
              style={{
                background: 'var(--bg-raised)',
                border: '1px solid var(--bg-border)',
                color: 'var(--text-soft)',
                cursor: sending ? 'not-allowed' : 'pointer',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (sending) return
                const el = e.currentTarget
                el.style.background = 'var(--accent-dim)'
                el.style.borderColor = 'color-mix(in srgb, var(--accent) 45%, transparent)'
                el.style.color = 'var(--text-main)'
                el.style.boxShadow = '0 2px 14px var(--accent-dim)'
                const arrow = el.querySelector<HTMLSpanElement>('[data-arrow]')
                if (arrow) arrow.style.opacity = '1'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget
                el.style.background = 'var(--bg-raised)'
                el.style.borderColor = 'var(--bg-border)'
                el.style.color = 'var(--text-soft)'
                el.style.boxShadow = 'none'
                const arrow = el.querySelector<HTMLSpanElement>('[data-arrow]')
                if (arrow) arrow.style.opacity = '0'
              }}
              onFocus={(e) => {
                const el = e.currentTarget
                el.style.borderColor = 'color-mix(in srgb, var(--accent) 55%, transparent)'
                el.style.boxShadow = '0 0 0 3px var(--input-focus)'
              }}
              onBlur={(e) => {
                const el = e.currentTarget
                el.style.borderColor = 'var(--bg-border)'
                el.style.boxShadow = 'none'
              }}
            >
              <span className="flex items-center gap-2">
                <span className="flex-shrink-0 text-xs" style={{ color: 'var(--accent)' }}>
                  ✦
                </span>
                <span className="flex-1 font-mono text-xs truncate">{prompt}</span>
                <span
                  data-arrow=""
                  className="flex-shrink-0 text-xs transition-opacity duration-150"
                  style={{ color: 'var(--accent)', opacity: 0 }}
                >
                  →
                </span>
              </span>
            </button>
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

// ── 自定义滚动条 ──────────────────────────────────────────────────────
interface CustomScrollbarProps {
  containerRef: React.RefObject<HTMLDivElement>
  scrollRatio: number       // 滚动条拇指位置 0~1
  thumbRatio: number        // 拇指高度占轨道比例 0~1
  visible: boolean
}

function CustomScrollbar({ containerRef, scrollRatio, thumbRatio, visible }: CustomScrollbarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const dragStartY = useRef(0)
  const dragStartScrollTop = useRef(0)

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // 点击轨道空白区域 → 按页滚动
    const track = trackRef.current
    const container = containerRef.current
    if (!track || !container) return
    const rect = track.getBoundingClientRect()
    const clickRatio = (e.clientY - rect.top) / rect.height
    const maxScroll = container.scrollHeight - container.clientHeight
    container.scrollTo({ top: clickRatio * maxScroll, behavior: 'smooth' })
  }

  const handleThumbMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    dragging.current = true
    dragStartY.current = e.clientY
    dragStartScrollTop.current = containerRef.current?.scrollTop ?? 0

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current || !trackRef.current) return
      const track = trackRef.current
      const container = containerRef.current
      const deltaY = ev.clientY - dragStartY.current
      const maxScroll = container.scrollHeight - container.clientHeight
      const trackH = track.clientHeight
      const scrollDelta = (deltaY / trackH) * (container.scrollHeight)
      container.scrollTop = Math.max(0, Math.min(maxScroll, dragStartScrollTop.current + scrollDelta))
    }

    const onMouseUp = () => {
      dragging.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }

  const thumbHeightPct = Math.max(thumbRatio * 100, 8) // 最小 8%
  const thumbTopPct = scrollRatio * (100 - thumbHeightPct)

  return (
    <div
      className="absolute right-0 top-0 bottom-0 flex items-stretch"
      style={{
        width: '14px',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.25s ease',
        pointerEvents: visible ? 'auto' : 'none',
        zIndex: 10,
      }}
    >
      {/* 轨道 */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className="relative mx-auto my-2 rounded-full cursor-pointer"
        style={{
          width: '4px',
          background: 'color-mix(in srgb, var(--bg-border) 80%, transparent)',
          flex: 1,
        }}
      >
        {/* 拇指 */}
        <div
          onMouseDown={handleThumbMouseDown}
          className="absolute left-0 right-0 rounded-full transition-colors duration-150"
          style={{
            top: `${thumbTopPct}%`,
            height: `${thumbHeightPct}%`,
            background: 'var(--scrollbar-thumb)',
            cursor: 'grab',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLDivElement).style.background = 'var(--accent)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLDivElement).style.background = 'var(--scrollbar-thumb)'
          }}
        />
      </div>
    </div>
  )
}

// ── 直达底部按钮 ──────────────────────────────────────────────────────
interface ScrollToBottomBtnProps {
  visible: boolean
  onClick: () => void
}

function ScrollToBottomBtn({ visible, onClick }: ScrollToBottomBtnProps) {
  return (
    <button
      onClick={onClick}
      title="回到底部"
      className="absolute flex items-center justify-center rounded-full shadow-lg transition-all duration-200"
      style={{
        right: '24px',
        bottom: '16px',
        width: '34px',
        height: '34px',
        background: 'var(--bg-raised)',
        border: '1px solid var(--bg-border)',
        color: 'var(--text-soft)',
        zIndex: 20,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.9)',
        pointerEvents: visible ? 'auto' : 'none',
        boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = 'var(--accent-dim)'
        el.style.borderColor = 'color-mix(in srgb, var(--accent) 40%, transparent)'
        el.style.color = 'var(--accent)'
        el.style.boxShadow = '0 4px 20px var(--accent-dim)'
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement
        el.style.background = 'var(--bg-raised)'
        el.style.borderColor = 'var(--bg-border)'
        el.style.color = 'var(--text-soft)'
        el.style.boxShadow = '0 4px 16px rgba(0,0,0,0.18)'
      }}
    >
      <ChevronDown size={16} />
    </button>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────
export default function ChatWindow() {
  const { activeConversation, sending, loading } = useChatStore()
  const messages = useVisibleMessages()
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  // 滚动条状态
  const [scrollRatio, setScrollRatio] = useState(0)
  const [thumbRatio, setThumbRatio] = useState(1)
  const [scrollbarVisible, setScrollbarVisible] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
  }

  const updateScrollState = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const maxScroll = el.scrollHeight - el.clientHeight
    const currentScroll = el.scrollTop
    const ratio = maxScroll > 0 ? currentScroll / maxScroll : 0
    const tRatio = maxScroll > 0 ? el.clientHeight / el.scrollHeight : 1
    const distFromBottom = maxScroll - currentScroll

    setScrollRatio(ratio)
    setThumbRatio(tRatio)
    stickToBottom.current = distFromBottom < 80
    setAtBottom(distFromBottom < 80)

    // 只有内容可滚动才显示
    if (maxScroll > 10) {
      setScrollbarVisible(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => setScrollbarVisible(false), 1800)
    }
  }, [])

  const handleScroll = useCallback(() => {
    updateScrollState()
  }, [updateScrollState])

  // 新增消息 → 重置到底部
  useEffect(() => {
    stickToBottom.current = true
    setAtBottom(true)
    scrollToBottom('smooth')
  }, [messages.length])

  // 流式结束
  useEffect(() => {
    if (!sending && stickToBottom.current) {
      scrollToBottom('smooth')
    }
  }, [sending])

  // 流式增量更新
  const lastMsgContent = messages[messages.length - 1]?.content ?? ''
  useEffect(() => {
    if (sending && stickToBottom.current) {
      scrollToBottom('instant')
    }
  }, [lastMsgContent, sending])

  // 内容/容器尺寸变化时刷新滚动条
  useEffect(() => {
    updateScrollState()
  }, [messages.length, lastMsgContent, updateScrollState])

  // ResizeObserver 监听容器大小
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    return () => ro.disconnect()
  }, [updateScrollState])

  const handleScrollToBottom = () => {
    stickToBottom.current = true
    scrollToBottom('smooth')
  }

  if (loading && !activeConversation) return <LoadingState />
  if (!activeConversation || messages.length === 0) return <EmptyState />

  return (
    <div className="flex-1 relative overflow-hidden">
      {/* 消息滚动区 — 隐藏原生滚动条 */}
      <div
        ref={containerRef}
        className="h-full overflow-y-auto py-6"
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none' }}   /* Firefox */
      >
        {/* 隐藏 webkit 原生滚动条 */}
        <style>{`
          .chat-scroll-area::-webkit-scrollbar { display: none; }
        `}</style>
        <div className="mx-auto w-full px-6 space-y-5" style={{ maxWidth: '720px' }}>
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* 自定义滚动条 */}
      <CustomScrollbar
        containerRef={containerRef as React.RefObject<HTMLDivElement>}
        scrollRatio={scrollRatio}
        thumbRatio={thumbRatio}
        visible={scrollbarVisible}
      />

      {/* 直达底部按钮 */}
      <ScrollToBottomBtn
        visible={!atBottom}
        onClick={handleScrollToBottom}
      />
    </div>
  )
}
