import type { AxiosResponse } from 'axios'
import httpClient from './httpClient'
import type {
  LoginPayload,
  RegisterPayload,
  LoginResponse,
  User,
  AskPayload,
  AskResponse,
  ConversationSummary,
  ConversationDetail,
  UploadResponse,
} from '@/types'

// ── Auth ───
export const authApi = {
  register: (data: RegisterPayload): Promise<AxiosResponse<User>> =>
    httpClient.post('/auth/register', data),

  login: (data: LoginPayload): Promise<AxiosResponse<LoginResponse>> =>
    httpClient.post('/auth/login', data),

  me: (): Promise<AxiosResponse<User>> =>
    httpClient.get('/auth/me'),
}

// ── Chat ──
export const chatApi = {
  ask: (data: AskPayload): Promise<AxiosResponse<AskResponse>> =>
    httpClient.post('/chat/ask', data),

  listConversations: (): Promise<AxiosResponse<ConversationSummary[]>> =>
    httpClient.get('/chat/conversations'),

  getConversation: (id: number): Promise<AxiosResponse<ConversationDetail>> =>
    httpClient.get(`/chat/conversations/${id}`),

  deleteConversation: (id: number): Promise<AxiosResponse<void>> =>
    httpClient.delete(`/chat/conversations/${id}`),
}

// ── Upload ───
export const uploadApi = {
  uploadFile: (
    file: File,
    conversationId: number | null = null,
  ): Promise<AxiosResponse<UploadResponse>> => {
    const form = new FormData()
    form.append('file', file)
    if (conversationId !== null) {
      form.append('conversation_id', String(conversationId))
    }
    return httpClient.post('/upload/file', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteAttachment: (attachmentId: number): Promise<AxiosResponse<void>> =>
    httpClient.delete(`/upload/file/${attachmentId}`),
}