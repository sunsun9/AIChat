import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore, selectIsPremium } from '@/store/authStore'
import { useChat } from '@/hooks/useChat'
import { useFileUpload } from '@/hooks/useFileUpload'
import FileUploadZone from './FileUploadZone'
import { Send, Paperclip, X, Square } from 'lucide-react'

export default function ChatInput() {
  const activeId = useChatStore((s) => s.activeId)
  const cancelCurrentRequest = useChatStore((s) => s.cancelCurrentRequest)
  const isPremium = useAuthStore(selectIsPremium)
  const [showUpload, setShowUpload] = useState(false)

  const chat = useChat()
  const upload = useFileUpload({ activeConversationId: activeId })

  // 切换会话时，丢弃上一个会话已上传但未发送的附件
  const prevActiveId = useRef(activeId)
  useEffect(() => {
    if (prevActiveId.current !== activeId) {
      upload.discardAllAttachments()
      setShowUpload(false)
    }
    prevActiveId.current = activeId
  }, [activeId])

  const handleSend = () => {
    const ids = upload.attachmentIds.slice() // 先快照 ID，防止清除后丢失
    upload.clearAttachments()               // ✅ 立即清空附件
    setShowUpload(false)                    // ✅ 立即收起附件区
    void chat.handleSend(ids)               // 异步发送，不再等它
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend() // 统一走 handleSend，确保附件也被清空
    }
  }

  const handleToggleUpload = () => {
    if (showUpload && upload.attachments.length > 0) {
      upload.discardAllAttachments()
    }
    setShowUpload((v) => !v)
  }

  const hasAttachments = upload.attachments.length > 0

  return (
    <div
      className="flex-shrink-0 px-4 pb-4 pt-3"
      style={{ background: 'var(--chatinput-bg)' }}
    >
      {/* 内容限宽居中，和消息区域对齐 */}
      <div className="mx-auto w-full" style={{ maxWidth: '720px' }}>
      {/* ── 错误提示 ── */}
      {chat.error && (
        <div
          className="flex items-center justify-between px-3 py-2 mb-2 rounded-lg text-xs animate-fade-in"
          style={{
            background: 'rgba(244,63,94,0.08)',
            border: '1px solid rgba(244,63,94,0.2)',
            color: '#f43f5e',
          }}
        >
          <span>{chat.error}</span>
          <button
            onClick={chat.clearError}
            className="ml-2 p-0.5 rounded hover:opacity-70 transition-opacity"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── 附件区域 ── */}
      {isPremium && showUpload && (
        <div className="mb-2 animate-fade-up">
          <FileUploadZone
            fileInputRef={upload.fileInputRef}
            attachments={upload.attachments}
            uploading={upload.uploading}
            error={upload.error}
            onInputChange={upload.handleInputChange}
            onDrop={upload.handleDrop}
            onRemove={upload.removeAttachment}
            onZoneClick={upload.openFilePicker}
          />
        </div>
      )}

      {/* ── 主输入框容器：参考 Claude.ai 风格 ── */}
      <div
        className="relative rounded-2xl transition-all duration-200"
        style={{
          background: 'var(--input-bg)',
          border: '1px solid var(--input-border)',
          boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
        }}
        onFocusCapture={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'color-mix(in srgb, var(--accent) 55%, transparent)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 3px var(--input-focus)'
        }}
        onBlurCapture={(e) => {
          ;(e.currentTarget as HTMLDivElement).style.borderColor = 'var(--input-border)'
          ;(e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 6px rgba(0,0,0,0.12)'
        }}
      >
        {/* textarea */}
        <textarea
          ref={chat.textRef}
          rows={1}
          value={chat.text}
          onChange={(e) => chat.setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="给智能助手发消息…"
          disabled={chat.sending}
          className="w-full text-sm outline-none resize-none leading-relaxed bg-transparent"
          style={{
            color: 'var(--text-main)',
            padding: '14px 50px 14px 16px',
            minHeight: '52px',
            maxHeight: '200px',
            overflowY: 'auto',
            display: 'block',
          }}
        />

        {/* ── 右下角按钮组 ── */}
        <div
          className="absolute right-2 bottom-2 flex items-center gap-1"
        >
          {/* 附件按钮（premium） */}
          {isPremium && (
            <button
              onClick={handleToggleUpload}
              title={showUpload ? '关闭附件' : '上传附件'}
              className="relative p-2 rounded-xl transition-all duration-150"
              style={
                showUpload || hasAttachments
                  ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                  : { color: 'var(--text-faint)' }
              }
              onMouseEnter={(e) => {
                if (!showUpload && !hasAttachments) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-raised)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-main)'
                }
              }}
              onMouseLeave={(e) => {
                if (!showUpload && !hasAttachments) {
                  ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-faint)'
                }
              }}
            >
              {hasAttachments && (
                <span
                  className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center"
                  style={{ background: 'var(--accent)', color: '#fff' }}
                >
                  {upload.attachments.length}
                </span>
              )}
              {showUpload ? <X size={15} /> : <Paperclip size={15} />}
            </button>
          )}

          {/* 发送 / 停止按钮 */}
          {chat.sending ? (
            <button
              onClick={cancelCurrentRequest}
              title="停止生成"
              className="p-2 rounded-xl transition-all duration-150 active:scale-95"
              style={{
                background: 'var(--bg-border)',
                color: 'var(--text-soft)',
              }}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.15)'
                ;(e.currentTarget as HTMLButtonElement).style.color = '#f43f5e'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-border)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--text-soft)'
              }}
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!chat.canSend}
              title="发送"
              className="p-2 rounded-xl transition-all duration-150 active:scale-95"
              style={
                chat.canSend
                  ? {
                      background: 'var(--accent)',
                      color: '#fff',
                      boxShadow: '0 0 12px var(--accent-dim)',
                    }
                  : {
                      background: 'var(--bg-border)',
                      color: 'var(--text-faint)',
                      cursor: 'not-allowed',
                    }
              }
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── 底部提示文字 ── */}
      <p
        className="text-[10px] text-center mt-2 font-mono"
        style={{ color: 'var(--text-faint)' }}
      >
        {isPremium
          ? '⚡ 高级用户 · 支持附件问答 · Enter 发送，Shift+Enter 换行'
          : 'Enter 发送，Shift+Enter 换行'}
      </p>
      </div>{/* end max-width wrapper */}
    </div>
  )
}
