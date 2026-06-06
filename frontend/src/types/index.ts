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

/** 登录响应（拦截器解包 { code, msg, data } 后的业务数据） */
export interface LoginResponse {
  token: string   // 后端重构后由 access_token 改名为 token
  user: User
}

// ── 统一响应包装（供高级用法参考）────
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

// ── 会话 ───
/** 侧边栏列表中展示的会话摘要 */
export interface ConversationSummary {
  id: number
  title: string
  created_at: string
  updated_at: string
  message_count: number
}

/** 打开会话后加载的完整数据（含消息列表） */
export interface ConversationDetail extends ConversationSummary {
  messages: (Message | OptimisticMessage)[]
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

// ── 接口错误（新统一格式）───
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