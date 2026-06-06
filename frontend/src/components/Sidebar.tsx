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
    <aside
      className="w-64 flex-shrink-0 h-full flex flex-col border-r"
      style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
    >
      {/* 头部区域 */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--bg-border)' }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--accent-dim)',
              border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
            }}
          >
            <Zap size={15} style={{ color: 'var(--accent)' }} />
          </div>
          <span
            className="font-display font-bold text-sm tracking-wide"
            style={{ color: 'var(--text-main)' }}
          >
            智能问答
          </span>
        </div>
        <button
          onClick={newConversation}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-dashed text-xs font-mono transition-all duration-200"
          style={{
            borderColor: 'var(--bg-border)',
            color: 'var(--text-soft)',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'color-mix(in srgb, var(--accent) 45%, transparent)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-dim)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bg-border)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-soft)'
            ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
          }}
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
            <MessageSquare size={28} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
            <p className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>暂无对话记录</p>
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => void openConversation(conv.id)}
            className={clsx(
              'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left group transition-all duration-150',
            )}
            style={
              activeId === conv.id
                ? {
                    background: 'var(--accent-dim)',
                    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                    color: 'var(--text-main)',
                  }
                : {
                    border: '1px solid transparent',
                    color: 'var(--text-soft)',
                  }
            }
          >
            <MessageSquare
              size={13}
              className="flex-shrink-0"
              style={{ color: activeId === conv.id ? 'var(--accent)' : 'var(--text-faint)' }}
            />
            <span className="flex-1 text-xs font-body truncate">{conv.title}</span>
            {conv.message_count > 0 && (
              <span
                className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-faint)' }}
              >
                {conv.message_count}
              </span>
            )}
            <button
              onClick={(e) => void requestDelete(e, conv.id)}
              title={pendingId === conv.id ? '再次点击确认' : '删除'}
              className={clsx(
                'opacity-0 group-hover:opacity-100 transition-all p-0.5 rounded',
              )}
              style={{ color: pendingId === conv.id ? '#f43f5e' : 'var(--text-faint)' }}
            >
              <Trash2 size={12} />
            </button>
          </button>
        ))}
      </div>

      {/* 用户底部区域 */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--bg-border)' }}>
        <div
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg"
          style={{ background: 'var(--bg-raised)', border: '1px solid var(--bg-border)' }}
        >
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-display font-bold"
            style={
              isPremium
                ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                : { background: 'var(--bg-border)', color: 'var(--text-soft)' }
            }
          >
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-main)' }}>
              {user?.username}
            </p>
            <span className={isPremium ? 'tag-premium' : 'tag-normal'}>
              {isPremium ? <Zap size={9} /> : <User size={9} />}
              {isPremium ? 'Premium' : 'Normal'}
            </span>
          </div>
          <button
            onClick={logout}
            title="退出登录"
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = '#f43f5e')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)')}
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
