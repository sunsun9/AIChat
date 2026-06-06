import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { login, register, extractAuthError } from '@/services/authService'
import type { UserRole } from '@/types'

export type AuthMode = 'login' | 'register'

export interface AuthFormValues {
  username: string
  email: string
  password: string
  role: UserRole
}

const DEFAULT_FORM: AuthFormValues = {
  username: '',
  email: '',
  password: '',
  role: 'normal',
}

export function useAuth() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const [mode, setMode] = useState<AuthMode>('login')
  const [form, setForm] = useState<AuthFormValues>(DEFAULT_FORM)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setField<K extends keyof AuthFormValues>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  function setRole(role: UserRole) {
    setForm((prev) => ({ ...prev, role }))
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (mode === 'register') {
        await register(form)
        setMode('login')
        setForm((prev) => ({ ...prev, email: '', role: 'normal' }))
        return
      }

      const { user, token } = await login({
        username: form.username,
        password: form.password,
      })
      setAuth(user, token)
      navigate('/chat')
    } catch (err) {
      setError(extractAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  return {
    mode,
    form,
    showPassword,
    loading,
    error,
    setField,
    setRole,
    switchMode,
    toggleShowPassword: () => setShowPassword((v) => !v),
    handleSubmit,
  }
}
