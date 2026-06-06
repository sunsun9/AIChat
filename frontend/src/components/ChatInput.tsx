import { useState } from 'react'
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

  const handleSend = () => {
    void chat.handleSend(upload.attachmentIds).then(() => {
      upload.clearAttachments()
      setShowUpload(false)
    })
  }

  return (
    <div className="border-t border-carbon-300 bg-carbon-50/80 backdrop-blur-sm px-4 py-3 space-y-2">
      {/* 错误提示横幅 */}
      {chat.error && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-ruby-dim border border-ruby-pill/20 text-ruby-pill text-xs font-mono animate-fade-in">
          <span>{chat.error}</span>
          <button onClick={chat.clearError} className="ml-2 hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      {/* 上传区域 — 仅限高级用户，可切换显示状态 */}
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
        className={clsx(
          'flex items-end gap-2 rounded-xl border p-2 transition-all duration-200',
          'bg-carbon-200 border-carbon-400 focus-within:border-amber/40 focus-within:bg-carbon-100/50',
        )}
      >
        {/* 附件切换按钮（仅限高级用户） */}
        {isPremium && (
          <button
            onClick={() => setShowUpload((v) => !v)}
            title="上传附件"
            className={clsx(
              'flex-shrink-0 p-2 rounded-lg transition-all duration-150',
              showUpload
                ? 'bg-amber/15 text-amber'
                : 'text-slate-muted hover:text-amber hover:bg-amber/10',
            )}
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
          className="flex-1 bg-transparent text-ice text-sm font-body placeholder-slate-faint outline-none resize-none leading-relaxed py-1 px-1 min-h-[36px] max-h-[180px]"
          style={{ overflowY: 'auto' }}
        />

        {/* 发送按钮 */}
        <button
          onClick={handleSend}
          disabled={!chat.canSend}
          className={clsx(
            'flex-shrink-0 p-2 rounded-lg transition-all duration-150 active:scale-95',
            chat.canSend
              ? 'bg-amber text-carbon hover:bg-amber-light shadow-amber-glow'
              : 'bg-carbon-400 text-slate-faint cursor-not-allowed',
          )}
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

      <p className="text-[10px] text-slate-faint text-center font-mono">
        {isPremium
          ? '⚡ 高级用户 · 支持文本 + .txt 附件问答'
          : '文本问答模式 · 升级为高级用户可上传附件'}
      </p>
    </div>
  )
}