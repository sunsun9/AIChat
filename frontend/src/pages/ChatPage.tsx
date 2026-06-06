import Sidebar from '@/components/Sidebar'
import ChatWindow from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import ThemeToggle from '@/components/ThemeToggle'
import { useChatStore } from '@/store/chatStore'

export default function ChatPage() {
  const title = useChatStore((s) => s.activeConversation?.title)

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      <Sidebar />

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <header
          className="flex items-center gap-3 px-6 py-3.5 border-b backdrop-blur-sm flex-shrink-0"
          style={{
            background: 'var(--header-bg)',
            borderColor: 'var(--bg-border)',
          }}
        >
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
