import Sidebar from '@/components/Sidebar'
import ChatWindow from '@/components/ChatWindow'
import ChatInput from '@/components/ChatInput'
import { useChatStore } from '@/store/chatStore'

export default function ChatPage() {
  const title = useChatStore((s) => s.activeConversation?.title)

  return (
    <div className="h-screen flex overflow-hidden bg-carbon">
      <Sidebar />

      {/* Main panel */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        {/* Top bar */}
        <header className="flex items-center gap-3 px-6 py-3.5 border-b border-carbon-300 bg-carbon-50/60 backdrop-blur-sm flex-shrink-0">
          <div className="flex-1 min-w-0">
            {title ? (
              <h1 className="font-display font-semibold text-ice text-sm truncate">{title}</h1>
            ) : (
              <h1 className="font-display font-semibold text-slate-faint text-sm">新对话</h1>
            )}
          </div>
          <div
            className="flex-shrink-0 w-2 h-2 rounded-full bg-emerald-pill animate-pulse-soft"
            title="服务正常"
          />
        </header>

        <ChatWindow />
        <ChatInput />
      </main>
    </div>
  )
}
