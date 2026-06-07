/**
 * httpClient.ts
 *
 * Axios 实例，负责：
 *  1. 每次请求自动注入 JWT Bearer token
 *  2. 统一解包响应格式 { code, msg, data }
 *  3. 401 时自动用 refresh_token 换取新 token 并重试原请求
 *     - 多个并发请求同时 401 时只发一次 refresh，其余入队等待
 *     - refresh 失败 → 清除所有凭证 → 跳转登录页
 */
import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import {
  getRefreshToken,
  saveNewAccessToken,
  clearPersistedAuth,
} from '@/services/authService'

// ── Axios 实例 ───────────────────────────────────────────────────────────

export const httpClient = axios.create({
  baseURL: '/api/v1',
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
})

// ── 并发 401 处理：刷新队列 ─────────────────────────────────────────────

type QueueEntry = {
  resolve: (token: string) => void
  reject: (err: unknown) => void
}

let isRefreshing = false
let refreshQueue: QueueEntry[] = []

function drainQueue(err: unknown, newToken?: string): void {
  refreshQueue.forEach((entry) => {
    if (err) {
      entry.reject(err)
    } else {
      entry.resolve(newToken!)
    }
  })
  refreshQueue = []
}

function redirectToLogin(): void {
  clearPersistedAuth()
  window.location.href = '/login'
}

// ── 请求拦截器：注入 token ───────────────────────────────────────────────

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ── 响应拦截器 ───────────────────────────────────────────────────────────

httpClient.interceptors.response.use(
  // ① 成功响应：解包 { code, msg, data }
  (res) => {
    const body = res.data
    if (body !== null && typeof body === 'object' && 'code' in body && 'data' in body) {
      if (body.code !== 0) {
        const err = new Error(body.msg ?? '请求失败') as Error & { bizCode?: number }
        err.bizCode = body.code
        return Promise.reject(err)
      }
      res.data = body.data
    }
    return res
  },

  // ② 错误响应
  async (err: unknown) => {
    if (!axios.isAxiosError(err)) return Promise.reject(err)

    const originalConfig = err.config as InternalAxiosRequestConfig & { _retry?: boolean }
    const is401 = err.response?.status === 401

    // 非 401，或者是 refresh 接口本身返回的 401 → 直接失败
    const isRefreshEndpoint = originalConfig?.url?.includes('/auth/refresh')
    if (!is401 || isRefreshEndpoint || originalConfig?._retry) {
      return Promise.reject(err)
    }

    // ── 已有 refresh 进行中：将本次请求加入队列等待 ────────────────────
    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject })
      }).then((newToken) => {
        originalConfig.headers.Authorization = `Bearer ${newToken}`
        return httpClient(originalConfig)
      })
    }

    // ── 本请求触发 refresh ──────────────────────────────────────────────
    const rt = getRefreshToken()
    if (!rt) {
      redirectToLogin()
      return Promise.reject(err)
    }

    isRefreshing = true
    originalConfig._retry = true

    try {
      // 直接用 axios（不走 httpClient）避免再次触发拦截器死循环
      const refreshRes = await axios.post('/api/v1/auth/refresh', { refresh_token: rt })

      // 解包统一响应格式
      const body = refreshRes.data
      const newData = (body?.data ?? body) as { token: string; refresh_token: string }

      const newAccessToken = newData.token
      const newRefreshToken = newData.refresh_token

      // 持久化新 token
      saveNewAccessToken(newAccessToken)
      localStorage.setItem('refresh_token', newRefreshToken)  // 轮转

      // 通知所有等待中的请求
      drainQueue(null, newAccessToken)

      // 重试原始请求
      originalConfig.headers.Authorization = `Bearer ${newAccessToken}`
      return httpClient(originalConfig)
    } catch (refreshErr) {
      // refresh 失败 → 全部请求失败 → 跳转登录
      drainQueue(refreshErr)
      redirectToLogin()
      return Promise.reject(refreshErr)
    } finally {
      isRefreshing = false
    }
  },
)

export default httpClient
