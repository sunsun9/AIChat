/**
 * httpClient.ts
 *
 * 纯 Axios 实例，负责 JWT 注入与 401 跳转。
 * 响应拦截器自动解包统一响应格式 { code, msg, data }，
 * 使所有调用方可直接从 res.data 获取业务数据。
 */
import axios from 'axios'

export const httpClient = axios.create({
  baseURL: '/api/v1',
  timeout: 60_000, // 60 秒，为 LLM 调用留足余量
  headers: { 'Content-Type': 'application/json' },
})

// 每次请求出发前自动注入 JWT
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 1. 解包成功响应的 { code, msg, data } 外层包装
// 2. 处理 401：清除凭证并跳转至登录页
httpClient.interceptors.response.use(
  (res) => {
    const body = res.data
    if (body !== null && typeof body === 'object' && 'code' in body && 'data' in body) {
      if (body.code !== 0) {
        return Promise.reject(new Error(body.msg ?? '请求失败'))
      }
      // 解包：将外层包装替换为实际业务数据
      res.data = body.data
    }
    return res
  },
  (err: unknown) => {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export default httpClient