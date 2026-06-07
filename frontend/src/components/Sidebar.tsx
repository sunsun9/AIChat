import { useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore, selectIsPremium } from '@/store/authStore'
import { useConversationDelete } from '@/hooks/useConversationDelete'
import { Plus, MessageSquare, Trash2, LogOut, Zap, User, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const isPremium = useAuthStore(selectIsPremium)
  const { conversations, activeId, loading, loadConversations, openConversation, newConversation, deleteConversation } =
    useChatStore()

  const { pendingId, requestDelete } = useConversationDelete(deleteConversation)

  useEffect(() => {
    if (conversations.length === 0) {
      void loadConversations()
    }
  }, [])

  return (
    <aside
      className="flex-shrink-0 h-full flex flex-col border-r relative"
      style={{
        width: isCollapsed ? '56px' : '256px',
        transition: 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'var(--sidebar-bg)',
        borderColor: 'var(--sidebar-border)',
        overflow: 'visible',
      }}
    >
      {/* 收起 / 展开 悬浮按钮 */}
      <button
        onClick={onToggle}
        title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        className="absolute z-20 flex items-center justify-center rounded-full border transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          top: '58px',
          right: '-12px',
          width: '24px',
          height: '24px',
          background: 'var(--bg-raised)',
          borderColor: 'var(--bg-border)',
          color: 'var(--text-soft)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'color-mix(in srgb, var(--accent) 50%, transparent)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bg-border)'
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-soft)'
        }}
      >
        {isCollapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      {/* 头部区域 */}
      <div
        className="border-b flex-shrink-0"
        style={{
          borderColor: 'var(--bg-border)',
          padding: isCollapsed ? '12px 8px' : '16px',
          transition: 'padding 0.25s ease',
        }}
      >
        <div
          className="flex items-center"
          style={{
            gap: isCollapsed ? 0 : '10px',
            marginBottom: isCollapsed ? 0 : '16px',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
          }}
        >
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
            className="font-display font-bold text-sm tracking-wide whitespace-nowrap overflow-hidden"
            style={{
              color: 'var(--text-main)',
              maxWidth: isCollapsed ? '0px' : '160px',
              opacity: isCollapsed ? 0 : 1,
              transition: 'max-width 0.25s ease, opacity 0.2s ease',
            }}
          >
            智能问答
          </span>
        </div>

        {/* 新对话按钮 */}
        <button
          onClick={newConversation}
          title="新对话"
          className="w-full flex items-center rounded-lg border border-dashed text-xs font-mono transition-all duration-200"
          style={{
            justifyContent: isCollapsed ? 'center' : 'center',
            gap: isCollapsed ? 0 : '8px',
            padding: isCollapsed ? '6px' : '8px',
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
          <Plus size={14} className="flex-shrink-0" />
          <span
            className="overflow-hidden whitespace-nowrap"
            style={{
              maxWidth: isCollapsed ? '0px' : '80px',
              opacity: isCollapsed ? 0 : 1,
              transition: 'max-width 0.25s ease, opacity 0.2s ease',
            }}
          >
            新对话
          </span>
        </button>
      </div>

      {/* 对话列表 */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5" style={{ padding: '8px 6px' }}>
        {loading && conversations.length === 0 && (
          <div className="space-y-2 px-1 py-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-9 rounded-lg skeleton"
                style={{ animationDelay: `${i * 0.1}s` }}
              />
            ))}
          </div>
        )}

        {!loading && conversations.length === 0 && !isCollapsed && (
          <div className="text-center py-10 px-4">
            <MessageSquare size={28} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
            <p className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>暂无对话记录</p>
          </div>
        )}

        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => void openConversation(conv.id)}
            title={isCollapsed ? conv.title : undefined}
            className={clsx(
              'w-full flex items-center rounded-lg text-left group transition-all duration-150',
            )}
            style={{
              gap: isCollapsed ? 0 : '8px',
              padding: isCollapsed ? '8px 6px' : '10px 12px',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              ...(activeId === conv.id
                ? {
                    background: 'var(--accent-dim)',
                    border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
                    color: 'var(--text-main)',
                  }
                : {
                    border: '1px solid transparent',
                    color: 'var(--text-soft)',
                  }),
            }}
          >
            <MessageSquare
              size={13}
              className="flex-shrink-0"
              style={{ color: activeId === conv.id ? 'var(--accent)' : 'var(--text-faint)' }}
            />
            <span
              className="text-xs font-body truncate overflow-hidden whitespace-nowrap"
              style={{
                flex: isCollapsed ? '0 0 0' : '1',
                maxWidth: isCollapsed ? '0px' : '999px',
                opacity: isCollapsed ? 0 : 1,
                transition: 'max-width 0.25s ease, opacity 0.15s ease',
              }}
            >
              {conv.title}
            </span>
            {!isCollapsed && conv.message_count > 0 && (
              <span
                className="text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--text-faint)' }}
              >
                {conv.message_count}
              </span>
            )}
            {!isCollapsed && (
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
            )}
          </button>
        ))}
      </div>

      {/* 用户底部区域 */}
      <div className="border-t flex-shrink-0" style={{ borderColor: 'var(--bg-border)', padding: '12px' }}>
        {isCollapsed ? (
          /* 收起时只显示头像 */
          <div className="flex justify-center">
            <button
              onClick={logout}
              title={`${user?.username ?? ''} · 退出登录`}
              className="relative group"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-display font-bold transition-all duration-150"
                style={
                  isPremium
                    ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                    : { background: 'var(--bg-border)', color: 'var(--text-soft)' }
                }
              >
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <span
                className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}
              >
                <LogOut size={12} />
              </span>
            </button>
          </div>
        ) : (
          /* 展开时显示完整用户信息 */
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
        )}
      </div>
    </aside>
  )
}
