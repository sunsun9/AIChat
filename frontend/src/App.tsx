import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { useChatStore } from './store/chatStore'

export default function App() {
  const token = useAuthStore((s) => s.token)
  const theme = useThemeStore((s) => s.theme)
  const loadConversations = useChatStore((s) => s.loadConversations)

  // 主题
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 登录态存在时立即预取会话列表，避免进入 ChatPage 后才开始请求
  useEffect(() => {
    if (token) {
      void loadConversations()
    }
  }, [token, loadConversations])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/chat" replace /> : <AuthPage />}
        />
        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to={token ? '/chat' : '/login'} replace />} />
      </Routes>
    </BrowserRouter>
  )
}
