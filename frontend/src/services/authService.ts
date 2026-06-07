/**
 * services/authService.ts
 *
 * 认证相关业务逻辑。
 * 持久化策略：token + refresh_token + user 均存入 localStorage。
 */
import axios from 'axios'
import { authApi } from '@/api'
import type { LoginPayload, RegisterPayload, User, AuthState, ApiError } from '@/types'

const TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refresh_token'
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

function persistAuth(user: User, token: string, refreshToken: string): void {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearPersistedAuth(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function saveNewAccessToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

// ── 认证操作 ───

export interface AuthServiceResult {
  user: User
  token: string
}

/** 登录并持久化凭证（access + refresh token），失败时抛出异常。 */
export async function login(payload: LoginPayload): Promise<AuthServiceResult> {
  const { data } = await authApi.login(payload)
  persistAuth(data.user, data.token, data.refresh_token)
  return { user: data.user, token: data.token }
}

/**
 * 注册新账号。
 * 不自动登录，由调用方决定后续行为。
 */
export async function register(payload: RegisterPayload): Promise<void> {
  await authApi.register(payload)
}

/**
 * 退出登录：
 * 1. 通知服务端吊销 refresh token（best-effort，不等待）
 * 2. 清除本地所有凭证
 */
export function logout(): void {
  const rt = getRefreshToken()
  if (rt) {
    // 不 await：用户体验优先，失败也无妨（token 会自然过期）
    authApi.logout(rt).catch(() => {})
  }
  clearPersistedAuth()
}

/** 从认证错误中提取用户友好的提示信息。 */
export function extractAuthError(err: unknown): string {
  if (axios.isAxiosError(err)) {
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
