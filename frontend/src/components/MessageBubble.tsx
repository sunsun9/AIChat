import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Paperclip, Bot, User } from 'lucide-react'
import clsx from 'clsx'
import type { Message, Attachment, StreamingMessage } from '@/types'

const codeTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'var(--code-block-bg)',
    border: '1px solid var(--code-block-border)',
    borderRadius: '8px',
    margin: 0,
    fontSize: '0.8rem',
  },
}

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
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono"
      style={{
        background: 'var(--accent-dim)',
        border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
        color: 'var(--accent)',
      }}
    >
      <Paperclip size={10} />
      {attachment.original_filename}
      <span style={{ color: 'color-mix(in srgb, var(--accent) 50%, transparent)' }}>
        ({Math.round(attachment.file_size / 1024)} KB)
      </span>
    </div>
  )
}

/** 流式光标动画 */
function StreamingCursor() {
  return (
    <span
      className="inline-block w-[2px] h-[1em] ml-0.5 align-middle animate-pulse"
      style={{ background: 'var(--accent)', borderRadius: '1px' }}
    />
  )
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

type AnyMessage = Message | StreamingMessage

interface MessageBubbleProps {
  message: AnyMessage
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isOptimistic = String(message.id).startsWith('opt-')
  const isStreaming = 'isStreaming' in message && message.isStreaming

  return (
    <div className={clsx('flex gap-3 animate-fade-up', isUser && 'flex-row-reverse')}>
      {/* 头像 */}
      <div
        className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
        style={
          isUser
            ? { background: 'var(--bg-raised)', border: '1px solid var(--bg-border)' }
            : {
                background: 'var(--accent-dim)',
                border: '1px solid color-mix(in srgb, var(--accent) 28%, transparent)',
                boxShadow: '0 0 10px var(--accent-dim)',
              }
        }
      >
        {isUser ? (
          <User size={13} style={{ color: 'var(--text-soft)' }} />
        ) : (
          <Bot size={13} style={{ color: 'var(--accent)' }} />
        )}
      </div>

      {/* 消息气泡 */}
      <div className={clsx('max-w-[75%] space-y-2', isUser && 'items-end flex flex-col')}>
        {isUser && message.attachments.length > 0 && (
          <div className="flex flex-wrap gap-1.5 justify-end">
            {message.attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} />
            ))}
          </div>
        )}

        <div
          className={clsx('px-4 py-3 rounded-2xl text-sm leading-relaxed', isOptimistic && 'opacity-60')}
          style={
            isUser
              ? {
                  background: 'var(--bubble-user-bg)',
                  border: '1px solid var(--bubble-user-border)',
                  color: 'var(--text-main)',
                  borderTopRightRadius: '4px',
                }
              : {
                  background: 'var(--bubble-ai-bg)',
                  border: '1px solid var(--bubble-ai-border)',
                  color: 'var(--text-main)',
                  borderTopLeftRadius: '4px',
                }
          }
        >
          {isUser ? (
            <p className="font-body whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-chat">
              {/* 流式消息：内容为空时显示光标等待动画 */}
              {isStreaming && message.content === '' ? (
                <div className="flex gap-1 items-center h-4">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </div>
              ) : (
                <>
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
                  {/* 流式进行中：末尾加光标 */}
                  {isStreaming && <StreamingCursor />}
                </>
              )}
            </div>
          )}
        </div>

        {/* 时间戳：流式进行中不显示 */}
        {!isOptimistic && !isStreaming && (
          <span className="text-[10px] font-mono px-1" style={{ color: 'var(--text-faint)' }}>
            {formatTime(message.created_at)}
          </span>
        )}
      </div>
    </div>
  )
}
