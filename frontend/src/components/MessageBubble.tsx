import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Paperclip, Bot, User } from 'lucide-react'
import clsx from 'clsx'
import type { Message, Attachment } from '@/types'

// ── 语法高亮主题 ───
const codeTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#141418',
    border: '1px solid #28282f',
    borderRadius: '8px',
    margin: 0,
    fontSize: '0.8rem',
  },
}

// ── 子组件 ────
interface CodeBlockProps {
  className?: string
  children: React.ReactNode
}

function CodeBlock({ className, children }: CodeBlockProps) {
  const lang = /language-(\w+)/.exec(className ?? '')?.[1] ?? 'text'
  return (
    <SyntaxHighlighter language={lang} style={codeTheme} PreTag="div">
      {String(children).replace(/\n$/, '')}
    </SyntaxHighlighter>
  )
}

interface AttachmentChipProps {
  attachment: Attachment
}

function AttachmentChip({ attachment }: AttachmentChipProps) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber/8 border border-amber/20 text-amber text-xs font-mono">
      <Paperclip size={10} />
      {attachment.original_filename}
      <span className="text-amber/50">({Math.round(attachment.file_size / 1024)} KB)</span>
    </div>
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// ── 主组件 ────
interface MessageBubbleProps {
  message: Message
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isOptimistic = String(message.id).startsWith('opt-')

  return (
    <div className={clsx('flex gap-3 animate-fade-up', isUser && 'flex-row-reverse')}>
      {/* 头像 */}
      <div
        className={clsx(
          'w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5',
          isUser
            ? 'bg-carbon-300 border border-carbon-400'
            : 'bg-amber/10 border border-amber/25 shadow-amber-glow',
        )}
      >
        {isUser ? (
          <User size={13} className="text-slate-soft" />
        ) : (
          <Bot size={13} className="text-amber" />
        )}
      </div>

      {/* 消息气泡 */}
      <div className={clsx('max-w-[75%] space-y-2', isUser && 'items-end flex flex-col')}>
        {/* 附件（在用户消息的气泡上方显示） */}
        {isUser && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end">
            {message.attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} />
            ))}
          </div>
        )}

        <div
          className={clsx(
            'px-4 py-3 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-carbon-200 border border-carbon-400 text-ice rounded-tr-sm'
              : 'bg-carbon-50 border border-carbon-300 text-ice rounded-tl-sm',
            isOptimistic && 'opacity-60',
          )}
        >
          {isUser ? (
            <p className="font-body whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }) {
                    const isInline = !className
                    return isInline ? (
                      <code className={className} {...props}>
                        {children}
                      </code>
                    ) : (
                      <CodeBlock className={className}>{children}</CodeBlock>
                    )
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* 时间戳 */}
        {!isOptimistic && (
          <span className="text-[10px] font-mono text-slate-faint px-1">
            {formatTime(message.created_at)}
          </span>
        )}
      </div>
    </div>
  )
}