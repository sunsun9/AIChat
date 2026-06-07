import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore, selectIsPremium } from '@/store/authStore'
import { useChat } from '@/hooks/useChat'
import { useFileUpload } from '@/hooks/useFileUpload'
import FileUploadZone from './FileUploadZone'
import { Send, Zap } from 'lucide-react'
import clsx from 'clsx'

export default function ChatInput() {
  const activeId = useChatStore((s) => s.activeId)
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
    void chat.handleSend(upload.attachmentIds).then(() => {
      upload.clearAttachments()
      setShowUpload(false)
    })
  }

  /** 折叠面板时，若有未发送附件则同步删除服务端文件 */
  const handleToggleUpload = () => {
    if (showUpload && upload.attachments.length > 0) {
      upload.discardAllAttachments()
    }
    setShowUpload((v) => !v)
  }

  return (
    <div
      className="border-t px-4 py-3 space-y-2 backdrop-blur-sm"
      style={{ background: 'var(--chatinput-bg)', borderColor: 'var(--bg-border)' }}
    >
      {/* 错误提示横幅 */}
      {chat.error && (
        <div
          className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-mono animate-fade-in"
          style={{
            background: 'rgba(244,63,94,0.10)',
            border: '1px solid rgba(244,63,94,0.25)',
            color: '#f43f5e',
          }}
        >
          <span>{chat.error}</span>
          <button onClick={chat.clearError} className="ml-2 hover:opacity-70">✕</button>
        </div>
      )}

      {/* 上传区域 */}
      {isPremium && showUpload && (
        <div className="animate-fade-up">
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

      {/* 输入行 */}
      <div
        className="flex items-end gap-2 rounded-xl border p-2 transition-all duration-200"
        style={{ background: 'var(--input-bg)', borderColor: 'var(--input-border)' }}
      >
        {/* 附件切换按钮 */}
        {isPremium && (
          <button
            onClick={handleToggleUpload}
            title="上传附件"
            className="flex-shrink-0 p-2 rounded-lg transition-all duration-150"
            style={
              showUpload
                ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                : { color: 'var(--text-faint)' }
            }
          >
            <Zap size={16} />
          </button>
        )}

        {/* 文本输入框 */}
        <textarea
          ref={chat.textRef}
          rows={1}
          value={chat.text}
          onChange={(e) => chat.setText(e.target.value)}
          onKeyDown={(e) => chat.handleKeyDown(e, upload.attachmentIds)}
          placeholder={
            isPremium
              ? '输入问题，或上传附件后提问… (Enter 发送，Shift+Enter 换行)'
              : '输入您的问题… (Enter 发送，Shift+Enter 换行)'
          }
          disabled={chat.sending}
          className="flex-1 text-sm font-body outline-none resize-none leading-relaxed py-1 px-1 min-h-[36px] max-h-[180px]"
          style={{
            background: 'transparent',
            color: 'var(--text-main)',
            overflowY: 'auto',
          }}
        />

        {/* 发送按钮 */}
        <button
          onClick={handleSend}
          disabled={!chat.canSend}
          className={clsx(
            'flex-shrink-0 p-2 rounded-lg transition-all duration-150 active:scale-95',
          )}
          style={
            chat.canSend
              ? {
                  background: 'var(--accent)',
                  color: '#fff',
                  boxShadow: '0 0 14px var(--accent-dim)',
                }
              : {
                  background: 'var(--bg-border)',
                  color: 'var(--text-faint)',
                  cursor: 'not-allowed',
                }
          }
        >
          {chat.sending ? (
            <span className="flex gap-0.5 px-0.5">
              <span className="typing-dot w-1 h-1" />
              <span className="typing-dot w-1 h-1" />
              <span className="typing-dot w-1 h-1" />
            </span>
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      <p className="text-[10px] text-center font-mono" style={{ color: 'var(--text-faint)' }}>
        {isPremium
          ? '⚡ 高级用户 · 支持文本 + .txt 附件问答'
          : '文本问答模式 · 升级为高级用户可上传附件'}
      </p>
    </div>
  )
}
