import { create } from 'zustand'

// 用户的全局状态管理

const stored = (() => {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    const token = localStorage.getItem('token') || null
    return { user, token }
  } catch {
    return { user: null, token: null }
  }
})()

export const useAuthStore = create((set) => ({
  user:  stored.user,
  token: stored.token,

  setAuth: (user, token) => {
    localStorage.setItem('user',  JSON.stringify(user))
    localStorage.setItem('token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('user')
    localStorage.removeItem('token')
    set({ user: null, token: null })
  },

  isPremium: () => {
    const state = useAuthStore.getState()
    return state.user?.role === 'premium'
  },
}))
