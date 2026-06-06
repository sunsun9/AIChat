import axios from 'axios'

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 60000, // 大模型响应超时时间
  headers: { 'Content-Type': 'application/json' },
})

// 添加请求拦截器 带上JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 添加响应拦截器，错误响应
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

// ── Auth ──
export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),
}

// ── Chat ──
export const chatApi = {
  ask: (data) => api.post('/chat/ask', data),

  listConversations: () => api.get('/chat/conversations'),

  getConversation: (id) => api.get(`/chat/conversations/${id}`),

  deleteConversation: (id) => api.delete(`/chat/conversations/${id}`),
}

// ── Upload ──
export const uploadApi = {
  uploadFile: (file, conversationId = null) => {
    const form = new FormData()
    form.append('file', file)
    if (conversationId) form.append('conversation_id', String(conversationId))
    return api.post('/upload/file', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

export default api
