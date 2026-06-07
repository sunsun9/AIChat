// ── 用户与认证 ───────────────────────────────────────────────────────

export type UserRole = 'normal' | 'premium'

export interface User {
  id: number
  username: string
  role: UserRole
}

export interface AuthState {
  user: User | null
  token: string | null
}

// ── 登录 / 注册 ────
export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  username: string
  password: string
  role: UserRole
}

export interface LoginResponse {
  token: string
  refresh_token: string   // ← 新增
  user: User
}

// ── 统一响应包装 ────
export interface ApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
}

// ── 附件 ───
export interface Attachment {
  id: number
  original_filename: string
  file_size: number
  content_preview?: string
}

// ── 消息 ────
export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string | number
  role: MessageRole
  content: string
  created_at: string
  attachments: Attachment[]
}

/** 服务器确认前乐观插入的用户消息 */
export interface OptimisticMessage extends Message {
  id: `opt-${number}`
  isOptimistic: true
}

/** 流式生成中的 AI 消息（尚未完成） */
export interface StreamingMessage {
  id: `streaming-${number}`
  role: 'assistant'
  content: string       // 累积的文本
  created_at: string
  attachments: []
  isStreaming: true
}

// ── 会话 ───
export interface ConversationSummary {
  id: number
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationDetail extends ConversationSummary {
  messages: (Message | OptimisticMessage | StreamingMessage)[]
}

// ── 接口请求体 ───
export interface AskPayload {
  conversation_id: number | null
  question: string
  attachment_ids: number[]
}

export interface AskResponse {
  conversation_id: number
  answer: string
}

export interface UploadResponse {
  attachment_id: number
  original_filename: string
  file_size: number
  content_preview: string
}

// ── 接口错误 ───
export interface ApiError {
  code: number
  msg: string
  data: null
}

// ── UI 状态辅助类型 ───
export interface SendMessageParams {
  question: string
  attachmentIds?: number[]
}
