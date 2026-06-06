import axios from 'axios'

export const httpClient = axios.create({
  baseURL: '/api/v1',
  timeout: 60_000, // 60 s — LLM响应
  headers: { 'Content-Type': 'application/json' },
})

// 添加请求拦截器 带上JWT token
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 添加响应拦截器，错误响应
httpClient.interceptors.response.use(
  (res) => res,
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
