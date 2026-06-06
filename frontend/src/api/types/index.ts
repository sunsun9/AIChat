// ── User & Auth ──
export type UserRole = 'normal' | 'premium'

export interface User {
  id: number
  username: string
  email: string
  role: UserRole
}

export interface AuthState {
  user: User | null
  token: string | null
}

// ── Login / Register ──
export interface LoginPayload {
  username: string
  password: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
  role: UserRole
}

export interface LoginResponse {
  access_token: string
  token_type: string
  user: User
}

// ── Attachment ───
export interface Attachment {
  id: number
  original_filename: string
  file_size: number
  content_preview?: string
}

// ── Message ───
export type MessageRole = 'user' | 'assistant'

export interface Message {
  id: string | number
  role: MessageRole
  content: string
  created_at: string
  attachments: Attachment[]
}

/** 用户已发送消息，但是服务器还未响应 */
export interface OptimisticMessage extends Message {
  id: `opt-${number}`
  isOptimistic: true
}

// ── Conversation ───
/** 列表显示对应对象形状 */
export interface ConversationSummary {
  id: number
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

/** 对话的消息 */
export interface ConversationDetail extends ConversationSummary {
  messages: (Message | OptimisticMessage)[]
}

// ── API payloads ───
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

// ── API error ───
export interface ApiError {
  detail: string
}

// ── UI state helpers ───
export interface SendMessageParams {
  question: string
  attachmentIds?: number[]
}
