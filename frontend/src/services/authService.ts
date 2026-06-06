/**
 * services/authService.ts
 *
 * 认证相关业务逻辑。
 * 负责 token 与用户信息的持久化策略（当前使用 localStorage）。
 * 组件和 store 调用此层，不直接操作底层 API。
 */
import axios from 'axios'
import { authApi } from '@/api'
import type { LoginPayload, RegisterPayload, User, AuthState, ApiError } from '@/types'

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

/** 登录并持久化凭证，失败时抛出异常。 */
export async function login(payload: LoginPayload): Promise<AuthServiceResult> {
  const { data } = await authApi.login(payload)
  // data 已由 httpClient 拦截器解包，直接为 { token, user }
  persistAuth(data.user, data.token)
  return { user: data.user, token: data.token }
}

/**
 * 注册新账号。
 * 不自动登录，由调用方决定后续行为。
 */
export async function register(payload: RegisterPayload): Promise<void> {
  await authApi.register(payload)
}

/** 清除本地所有认证状态。 */
export function logout(): void {
  clearPersistedAuth()
}

/** 从认证错误中提取用户友好的提示信息。 */
export function extractAuthError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    // 新统一错误格式：{ code, msg, data: null }
    const msg = (err.response?.data as Partial<ApiError>)?.msg
    return msg ?? '请求失败，请重试'
  }
  if (err instanceof Error) return err.message
  return '请求失败，请重试'
}

/** 判断当前用户是否拥有高级权限。 */
export function isPremiumUser(user: User | null): boolean {
  return user?.role === 'premium'
}