import { create } from 'zustand'
import { loadPersistedAuth, logout as serviceLogout } from '@/services/authService'
import type { User } from '@/types'

// 延迟导入避免循环依赖（authStore ← chatStore 均为叶子模块，实际无环）
import { useChatStore } from '@/store/chatStore'

interface AuthStore {
  user: User | null
  token: string | null

  setAuth: (user: User, token: string) => void
  logout: () => void
}

const { user, token } = loadPersistedAuth()

export const useAuthStore = create<AuthStore>()((set) => ({
  user,
  token,

  setAuth: (user, token) => set({ user, token }),

  logout: () => {
    serviceLogout()
    useChatStore.getState().resetChat()  // ← 清空上一个用户的聊天状态
    set({ user: null, token: null })
  },
}))

// 选择器辅助函数 ───
/** 如果当前用户拥有高级访问权限，则返回 true。 */
export const selectIsPremium = (state: AuthStore): boolean =>
  state.user?.role === 'premium'