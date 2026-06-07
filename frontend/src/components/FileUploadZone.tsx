import { Paperclip, X, FileText, FileType, ImageIcon, AlertCircle, CheckCircle2 } from 'lucide-react'
import { getFileCategory } from '@/services/uploadService'
import type { Attachment } from '@/types'

interface FileUploadZoneProps {
  fileInputRef: React.RefObject<HTMLInputElement>
  attachments: Attachment[]
  uploading: boolean
  error: string
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDrop: (e: React.DragEvent) => void
  onRemove: (id: number) => void
  onZoneClick: () => void
}

/** 根据文件名返回对应图标 */
function AttachmentIcon({ filename }: { filename: string }) {
  const cat = getFileCategory(filename)
  if (cat === 'pdf')   return <FileType size={10} />
  if (cat === 'image') return <ImageIcon size={10} />
  return <FileText size={10} />
}

export default function FileUploadZone({
  fileInputRef, attachments, uploading, error,
  onInputChange, onDrop, onRemove, onZoneClick,
}: FileUploadZoneProps) {
  return (
    <div className="space-y-2">
      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={onZoneClick}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-dashed cursor-pointer transition-all duration-200"
        style={{
          borderColor: uploading
            ? 'color-mix(in srgb, var(--accent) 45%, transparent)'
            : 'var(--bg-border)',
          background: uploading ? 'var(--accent-dim)' : 'transparent',
          cursor: uploading ? 'wait' : 'pointer',
        }}
      >
        {/* 支持 txt / pdf / 常见图片格式 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.pdf,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
          onChange={onInputChange}
        />
        <div className="flex-shrink-0 transition-colors" style={{ color: uploading ? 'var(--accent)' : 'var(--text-faint)' }}>
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
        <span className="text-xs font-mono" style={{ color: 'var(--text-faint)' }}>
          {uploading ? '上传中...' : '点击或拖拽上传 · txt / pdf / 图片'}
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs animate-fade-in" style={{ color: '#f43f5e' }}>
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 animate-fade-in">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full text-xs font-mono group"
              style={{
                background: 'var(--accent-dim)',
                border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
                color: 'var(--accent)',
              }}
            >
              <AttachmentIcon filename={att.original_filename} />
              <span className="max-w-[140px] truncate">{att.original_filename}</span>
              <CheckCircle2 size={10} style={{ color: '#10b981' }} />
              <button
                onClick={() => onRemove(att.id)}
                className="p-0.5 rounded-full hover:opacity-70 transition-opacity"
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
