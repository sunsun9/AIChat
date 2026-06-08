import { useEffect, useRef, useState } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore, selectIsPremium } from '@/store/authStore'
import { useConversationDelete } from '@/hooks/useConversationDelete'
import { Plus, MessageSquare, Trash2, LogOut, Zap, User, PanelLeftClose, Pencil, Check, X } from 'lucide-react'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export default function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const isPremium = useAuthStore(selectIsPremium)
  const {
    conversations, activeId, loading,
    loadConversations, openConversation, newConversation,
    deleteConversation, renameConversation,
  } = useChatStore()

  const { pendingId, requestDelete } = useConversationDelete(deleteConversation)

  // ── 重命名状态 ──
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (conversations.length === 0) void loadConversations()
  }, [])

  // 进入编辑模式
  const startEditing = (e: React.MouseEvent, id: number, currentTitle: string) => {
    e.stopPropagation()
    setEditingId(id)
    setEditingTitle(currentTitle)
    // 等 input 渲染后聚焦并全选
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 0)
  }

  // 确认重命名
  const confirmRename = async (id: number) => {
    const trimmed = editingTitle.trim()
    if (trimmed && trimmed !== conversations.find((c) => c.id === id)?.title) {
      await renameConversation(id, trimmed)
    }
    setEditingId(null)
  }

  // 取消编辑
  const cancelEdit = () => {
    setEditingId(null)
    setEditingTitle('')
  }

  // 键盘处理
  const handleKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void confirmRename(id)
    } else if (e.key === 'Escape') {
      cancelEdit()
    }
  }

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
            const isEditing = editingId === conv.id

            return (
              <div
                key={conv.id}
                className="w-full flex items-center gap-1.5 rounded-lg group mb-0.5 transition-all duration-150"
                style={{
                  padding: '5px 6px 5px 10px',
                  background: isActive ? 'var(--accent-dim)' : 'transparent',
                  border: '1px solid',
                  borderColor: isActive
                    ? 'color-mix(in srgb, var(--accent) 22%, transparent)'
                    : 'transparent',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'var(--bg-raised)'
                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--bg-border)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'
                  }
                }}
              >
                <MessageSquare
                  size={12}
                  className="flex-shrink-0 mt-px"
                  style={{ color: isActive ? 'var(--accent)' : 'var(--text-faint)' }}
                />

                {/* ── 标题区：编辑模式 or 展示模式 ── */}
                {isEditing ? (
                  /* 编辑状态：input + 确认/取消 */
                  <>
                    <input
                      ref={inputRef}
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, conv.id)}
                      onBlur={() => void confirmRename(conv.id)}
                      maxLength={100}
                      className="flex-1 min-w-0 text-xs bg-transparent outline-none border-b"
                      style={{
                        color: 'var(--text-main)',
                        borderColor: 'var(--accent)',
                        paddingBottom: '1px',
                      }}
                    />
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault()    // 阻止 input onBlur 先触发
                        void confirmRename(conv.id)
                      }}
                      title="确认"
                      className="flex-shrink-0 p-0.5 rounded transition-colors"
                      style={{ color: 'var(--accent)' }}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault()
                        cancelEdit()
                      }}
                      title="取消"
                      className="flex-shrink-0 p-0.5 rounded transition-colors"
                      style={{ color: 'var(--text-faint)' }}
                    >
                      <X size={11} />
                    </button>
                  </>
                ) : (
                  /* 展示状态：标题 + 操作按钮组 */
                  <>
                    <button
                      className="flex-1 min-w-0 text-left"
                      onClick={() => void openConversation(conv.id)}
                      title={conv.title}
                    >
                      <span
                        className="block text-xs truncate"
                        style={{ color: isActive ? 'var(--text-main)' : 'var(--text-soft)' }}
                      >
                        {conv.title}
                      </span>
                    </button>

                    {/* 消息数 */}
                    {conv.message_count > 0 && (
                      <span
                        className="text-[10px] font-mono flex-shrink-0 opacity-0 group-hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--text-faint)' }}
                      >
                        {conv.message_count}
                      </span>
                    )}

                    {/* 编辑按钮 */}
                    <button
                      onClick={(e) => startEditing(e, conv.id, conv.title)}
                      title="重命名"
                      className="flex-shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all duration-150"
                      style={{ color: 'var(--text-faint)' }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'
                      }}
                    >
                      <Pencil size={11} />
                    </button>

                    {/* 删除按钮 */}
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
                  </>
                )}
              </div>
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
