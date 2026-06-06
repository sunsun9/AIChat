import { Paperclip, X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import clsx from 'clsx'
import type { Attachment } from '@/types'

// ── 属性 ────
interface FileUploadZoneProps {
  fileInputRef: React.RefObject<HTMLInputElement | null>
  attachments: Attachment[]
  uploading: boolean
  error: string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDrop: (e: React.DragEvent) => void
  onRemove: (id: number) => void
  onZoneClick: () => void
}

// ── 组件 ───
export default function FileUploadZone({
  fileInputRef,
  attachments,
  uploading,
  error,
  onInputChange,
  onDrop,
  onRemove,
  onZoneClick,
}: FileUploadZoneProps) {
  return (
    <div className="space-y-2">
      {/* 拖拽区域 */}
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={onZoneClick}
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition-all duration-200',
          uploading
            ? 'border-amber/40 bg-amber/5 cursor-wait'
            : 'border-carbon-400 hover:border-amber/50 hover:bg-amber/5',
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt"
          className="hidden"
          onChange={onInputChange}
        />
        <div className={clsx('flex-shrink-0 transition-colors', uploading ? 'text-amber' : 'text-slate-muted')}>
          {uploading ? (
            <span className="flex gap-0.5">
              <span className="typing-dot w-1 h-1" />
              <span className="typing-dot w-1 h-1" />
              <span className="typing-dot w-1 h-1" />
            </span>
          ) : (
            <Paperclip size={14} />
          )}
        </div>
        <span className="text-xs text-slate-muted font-mono">
          {uploading ? '上传中...' : '点击或拖拽上传 .txt 文件'}
        </span>
      </div>

      {/* 验证 / 上传错误 */}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-ruby-pill animate-fade-in">
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      {/* 已附加的文件列表 */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 animate-fade-in">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-amber/8 border border-amber/25 text-amber text-xs font-mono group"
            >
              <FileText size={10} />
              <span className="max-w-[140px] truncate">{att.original_filename}</span>
              <CheckCircle2 size={10} className="text-emerald-pill" />
              <button
                onClick={() => onRemove(att.id)}
                className="p-0.5 rounded-full hover:bg-amber/20 transition-colors"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}