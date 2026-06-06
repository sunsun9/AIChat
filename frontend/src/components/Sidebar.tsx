import { useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore, selectIsPremium } from '@/store/authStore'
import { useConversationDelete } from '@/hooks/useConversationDelete'
import { Plus, MessageSquare, Trash2, LogOut, Zap, User } from 'lucide-react'
import clsx from 'clsx'

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const isPremium = useAuthStore(selectIsPremium)
  const { conversations, activeId, loading, loadConversations, openConversation, newConversation, deleteConversation } =
    useChatStore()

  const { pendingId, requestDelete } = useConversationDelete(deleteConversation)

  useEffect(() => {
    void loadConversations()
  }, [])

  return (
    <aside className="w-64 flex-shrink-0 h-full flex flex-col bg-carbon-50 border-r border-carbon-300">
      {/* 头部区域 */}
      <div className="p-4 border-b border-carbon-300">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center flex-shrink-0">
            <Zap size={15} className="text-amber" />
          </div>
          <span className="font-display font-bold text-ice text-sm tracking-wide">智能问答</span>
        </div>
        <button
          onClick={newConversation}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed border-carbon-400 text-slate-soft text-xs font-mono transition-all duration-200 hover:border-amber/40 hover:text-amber hover:bg-amber/5"
        >
          <Plus size={14} />
          新对话
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {loading && conversations.length === 0 && (
          <div className="space-y-2 px-2 py-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 rounded-lg skeleton"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}

        {!loading && conversations.length === 0 && (
          <div className="text-center py-10 px-4">
            <MessageSquare size={28} className="mx-auto mb-2 text-carbon-400" />
            <p className="text-slate-faint text-xs font-mono">暂无对话记录</p>
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => void openConversation(conv.id)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left group transition-all duration-150',
              activeId === conv.id
                ? 'bg-amber/8 border border-amber/20 text-ice'
                : 'hover:bg-carbon-200 text-slate-soft hover:text-ice border border-transparent',
            )}
          >
            <MessageSquare
              size={13}
              className={clsx('flex-shrink-0', activeId === conv.id ? 'text-amber' : 'text-slate-faint')}
            />
            <span className="flex-1 text-xs font-body truncate">{conv.title}</span>
            {conv.message_count > 0 && (
              <span className="text-[10px] font-mono text-slate-faint opacity-0 group-hover:opacity-100 transition-opacity">
                {conv.message_count}
              </span>
            )}
            <button
              onClick={(e) => void requestDelete(e, conv.id)}
              title={pendingId === conv.id ? '再次点击确认' : '删除'}
              className={clsx(
                'opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded',
                pendingId === conv.id
                  ? 'text-ruby-pill opacity-100'
                  : 'text-slate-faint hover:text-ruby-pill',
              )}
            >
              <Trash2 size={12} />
            </button>
          </button>
        ))}
      </div>

      {/* 用户底部区域 */}
      <div className="p-3 border-t border-carbon-300">
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg bg-carbon-200 border border-carbon-300">
          <div
            className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-display font-bold',
              isPremium ? 'bg-amber/15 text-amber' : 'bg-carbon-400 text-slate-soft',
            )}
          >
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-ice text-xs font-semibold truncate">{user?.username}</p>
            <span className={isPremium ? 'tag-premium' : 'tag-normal'}>
              {isPremium ? <Zap size={9} /> : <User size={9} />}
              {isPremium ? 'Premium' : 'Normal'}
            </span>
          </div>
          <button
            onClick={logout}
            title="退出登录"
            className="text-slate-faint hover:text-ruby-pill transition-colors p-1 rounded"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}