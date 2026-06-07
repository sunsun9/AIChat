import { useState } from 'react'
import Sidebar from '@/components/Sidebar'
import ChatWindow from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import ThemeToggle from '@/components/ThemeToggle'
import { useChatStore } from '@/store/chatStore'
import { PanelLeft } from 'lucide-react'

export default function ChatPage() {
  const title = useChatStore((s) => s.activeConversation?.title)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      <Sidebar
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((v) => !v)}
      />

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <header
          className="flex items-center gap-2 px-4 py-3 border-b backdrop-blur-sm flex-shrink-0"
          style={{
            background: 'var(--header-bg)',
            borderColor: 'var(--bg-border)',
            minHeight: '52px',
          }}
        >
          {/* 展开按钮：仅在收起时显示 */}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              title="展开侧边栏"
              className="flex-shrink-0 p-1.5 rounded-lg transition-all duration-150"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <PanelLeft size={16} />
            </button>
          )}

          <div className="flex-1 min-w-0">
            {title ? (
              <h1
                className="font-display font-semibold text-sm truncate"
                style={{ color: 'var(--text-main)' }}
              >
                {title}
              </h1>
            ) : (
              <h1
                className="font-display font-semibold text-sm"
                style={{ color: 'var(--text-faint)' }}
              >
                新对话
              </h1>
            )}
          </div>

          <ThemeToggle />

          <div
            className="flex-shrink-0 w-2 h-2 rounded-full animate-pulse-soft"
            style={{ background: '#10b981' }}
            title="服务正常"
          />
        </header>

        <ChatWindow />
        <ChatInput />
      </main>
    </div>
  )
}
