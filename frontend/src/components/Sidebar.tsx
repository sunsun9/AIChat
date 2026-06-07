import { useEffect } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore, selectIsPremium } from '@/store/authStore'
import { useConversationDelete } from '@/hooks/useConversationDelete'
import { Plus, MessageSquare, Trash2, LogOut, Zap, User, PanelLeftClose } from 'lucide-react'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const isPremium = useAuthStore(selectIsPremium)
  const {
    conversations, activeId, loading,
    loadConversations, openConversation, newConversation, deleteConversation,
  } = useChatStore()

  const { pendingId, requestDelete } = useConversationDelete(deleteConversation)

  useEffect(() => {
    if (conversations.length === 0) void loadConversations()
  }, [])

  return (
    <aside
      className="flex-shrink-0 h-full flex flex-col relative"
      style={{
        width: isCollapsed ? '0px' : '260px',
        minWidth: isCollapsed ? '0px' : '260px',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)',
        background: 'var(--sidebar-bg)',
        borderRight: isCollapsed ? 'none' : '1px solid var(--sidebar-border)',
        overflow: 'hidden',
      }}
    >
      {/* ── 内容包裹，宽度固定，随父级 overflow:hidden 裁剪 ── */}
      <div className="w-[260px] h-full flex flex-col">

        {/* ── 顶部：Logo + 收起按钮 ── */}
        <div className="flex items-center justify-between px-3 py-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background: 'var(--accent-dim)',
                border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
              }}
            >
              <Zap size={13} style={{ color: 'var(--accent)' }} />
            </div>
            <span
              className="font-display font-bold text-sm tracking-wide"
              style={{ color: 'var(--text-main)' }}
            >
              智能问答
            </span>
          </div>

          {/* 收起按钮：图标在侧边栏内部右上角 */}
          <button
            onClick={onToggle}
            title="收起侧边栏"
            className="p-1.5 rounded-lg transition-all duration-150"
            style={{ color: 'var(--text-faint)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'
            }}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>

        {/* ── 新对话按钮 ── */}
        <div className="px-3 pb-2 flex-shrink-0">
          <button
            onClick={newConversation}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150"
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--bg-border)',
              color: 'var(--text-soft)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-dim)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'color-mix(in srgb, var(--accent) 35%, transparent)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)'
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bg-border)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-soft)'
            }}
          >
            <Plus size={14} className="flex-shrink-0" />
            <span>新对话</span>
          </button>
        </div>

        {/* ── 对话列表标题 ── */}
        <div className="px-4 pb-1 flex-shrink-0">
          <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
            历史对话
          </span>
        </div>

        {/* ── 对话列表 ── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '2px 8px 8px' }}>
          {loading && conversations.length === 0 && (
            <div className="space-y-1 py-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-8 rounded-lg skeleton"
                  style={{ animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          )}

          {!loading && conversations.length === 0 && (
            <div className="text-center py-10 px-4">
              <MessageSquare size={24} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
              <p className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>暂无对话记录</p>
            </div>
          )}

          {conversations.map((conv) => {
            const isActive = activeId === conv.id
            const isPending = pendingId === conv.id
            return (
              <button
                key={conv.id}
                onClick={() => void openConversation(conv.id)}
                title={conv.title}
                className="w-full flex items-center gap-2 rounded-lg text-left group transition-all duration-150 mb-0.5"
                style={{
                  padding: '7px 10px',
                  background: isActive ? 'var(--accent-dim)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive
                    ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
                    : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--bg-border)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent'
                  }
                }}
              >
                <MessageSquare
                  size={12}
                  className="flex-shrink-0 mt-px"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-faint)' }}
                />
                <span
                  className="flex-1 text-xs truncate"
                  style={{ color: isActive ? 'var(--text-main)' : 'var(--text-soft)' }}
                >
                  {conv.title}
                </span>
                {conv.message_count > 0 && (
                  <span
                    className="text-[10px] font-mono flex-shrink-0 opacity-0 group-hover:opacity-70 transition-opacity"
                    style={{ color: 'var(--text-faint)' }}
                  >
                    {conv.message_count}
                  </span>
                )}
                <button
                  onClick={(e) => void requestDelete(e, conv.id)}
                  title={isPending ? '再次点击确认删除' : '删除'}
                  className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-150"
                  style={{ color: isPending ? '#f43f5e' : 'var(--text-faint)' }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.color = '#f43f5e'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.color = isPending ? '#f43f5e' : 'var(--text-faint)'
                  }}
                >
                  <Trash2 size={11} />
                </button>
              </button>
            )
          })}
        </div>

        {/* ── 底部用户区 ── */}
        <div
          className="flex-shrink-0 px-3 py-3"
          style={{ borderTop: '1px solid var(--bg-border)' }}
        >
          <div
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
            style={{
              background: 'var(--bg-raised)',
              border: '1px solid var(--bg-border)',
            }}
          >
            {/* 头像 */}
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

            {/* 用户名 + 角色 */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-main)' }}>
                {user?.username}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className="text-[10px] font-mono flex items-center gap-0.5"
                  style={{ color: isPremium ? 'var(--accent)' : 'var(--text-faint)' }}
                >
                  {isPremium ? <Zap size={8} /> : <User size={8} />}
                  {isPremium ? 'Premium' : 'Normal'}
                </span>
              </div>
            </div>

            {/* 退出按钮 */}
            <button
              onClick={logout}
              title="退出登录"
              className="p-1.5 rounded-lg flex-shrink-0 transition-all duration-150"
              style={{ color: 'var(--text-faint)' }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color = '#f43f5e'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.1)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  )
}
