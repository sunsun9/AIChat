import axios from 'axios'
import { authApi } from '@/api'
import type { LoginPayload, RegisterPayload, User, AuthState } from '@/types'

const TOKEN_KEY = 'token'
const USER_KEY = 'user'

// ── 持久化辅助函数 ───
export function loadPersistedAuth(): AuthState {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const raw = localStorage.getItem(USER_KEY)
    const user: User | null = raw ? (JSON.parse(raw) as User) : null
    return { token, user }
  } catch {
    return { token: null, user: null }
  }
}

function persistAuth(user: User, token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

function clearPersistedAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

// ── 认证操作 ───
export interface AuthServiceResult {
  user: User
  token: string
}

/** 登录并持久化凭证。失败时抛出异常。 */
export async function login(payload: LoginPayload): Promise<AuthServiceResult> {
  const { data } = await authApi.login(payload)
  persistAuth(data.user, data.access_token)
  return { user: data.user, token: data.access_token }
}

/**
 * 注册新账号。
 * 不会自动登录 — 由调用者决定下一步操作。
 */
export async function register(payload: RegisterPayload): Promise<void> {
  await authApi.register(payload)
}

/** 清除所有本地认证状态 */
export function logout(): void {
  clearPersistedAuth()
}

/** 从认证错误中提取对用户友好的错误信息 */
export function extractAuthError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string })?.detail
    return detail ?? '请求失败，请重试'
  }
  return '请求失败，请重试'
}

/** 验证高级用户 */
export function isPremiumUser(user: User | null): boolean {
  return user?.role === 'premium'
}
