import { Eye, EyeOff, Zap, User } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/ThemeToggle'
import type { AuthMode, AuthFormValues } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

interface RoleOption {
  value: UserRole
  icon: typeof User
  label: string
  desc: string
}

const ROLE_OPTIONS: RoleOption[] = [
  { value: 'normal', icon: User, label: '普通用户', desc: '文本问答' },
  { value: 'premium', icon: Zap, label: '高级用户', desc: '文本 + 附件' },
]

const MODE_LABELS: Record<AuthMode, string> = {
  login: '登录',
  register: '注册',
}

export default function AuthPage() {
  const {
    mode, form, showPassword, loading, error,
    setField, setRole, switchMode, toggleShowPassword, handleSubmit,
  } = useAuth()

  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* 背景网格 */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            'linear-gradient(var(--accent) 1px,transparent 1px),linear-gradient(90deg,var(--accent) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* 光晕 */}
      <div
        className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'var(--accent-dim)' }}
      />
      <div
        className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-60"
        style={{ background: 'var(--accent-dim)' }}
      />

      {/* 右上角主题切换 */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle />
      </div>

      <div className="relative z-10 w-full max-w-md px-4 animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{
              background: 'var(--accent-dim)',
              border: '1px solid color-mix(in srgb, var(--accent) 22%, transparent)',
              boxShadow: '0 0 28px var(--accent-dim)',
            }}
          >
            <Zap size={24} style={{ color: 'var(--accent)' }} />
          </div>
          <h1
            className="font-display text-3xl font-bold tracking-tight"
            style={{ color: 'var(--text-main)' }}
          >
            智能问答系统
          </h1>
          <p className="text-sm mt-1.5" style={{ color: 'var(--text-soft)' }}>
            由 Claude AI 驱动
          </p>
        </div>

        {/* 模式切换 */}
        <div
          className="flex rounded-xl p-1 border mb-6"
          style={{ background: 'var(--bg-raised)', borderColor: 'var(--bg-border)' }}
        >
          {(Object.keys(MODE_LABELS) as AuthMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className="flex-1 py-2 text-sm font-display font-semibold rounded-lg transition-all duration-200"
              style={
                mode === m
                  ? {
                      background: 'var(--accent)',
                      color: '#fff',
                      boxShadow: '0 0 16px var(--accent-dim)',
                    }
                  : { color: 'var(--text-soft)' }
              }
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>

        {/* 表单 */}
        <form onSubmit={(e) => void handleSubmit(e)} className="card p-6 space-y-4">
          <FormField label="用户名">
            <input
              className="input-field"
              placeholder="请输入用户名"
              value={form.username}
              onChange={setField('username')}
              required
              autoFocus
            />
          </FormField>

          {mode === 'register' && (
            <div className="animate-fade-up" />
          )}

          <FormField label="密码">
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input-field pr-10"
                placeholder="至少 6 位"
                value={form.password}
                onChange={setField('password')}
                required
              />
              <button
                type="button"
                onClick={toggleShowPassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: 'var(--text-faint)' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </FormField>

          {mode === 'register' && (
            <div className="animate-fade-up">
              <RoleSelector form={form} onSelectRole={setRole} />
            </div>
          )}

          {error && (
            <p
              className="text-sm rounded-lg px-3 py-2 animate-fade-in"
              style={{
                color: '#f43f5e',
                background: 'rgba(244,63,94,0.09)',
                border: '1px solid rgba(244,63,94,0.22)',
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <span className="flex gap-1">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </span>
            ) : mode === 'login' ? (
              '登录'
            ) : (
              '创建账号'
            )}
          </button>
        </form>

        <p className="text-center text-xs mt-5" style={{ color: 'var(--text-faint)' }}>
          演示账号：
          <span className="font-mono" style={{ color: 'var(--text-soft)' }}>normal_user</span>
          {' '}或{' '}
          <span className="font-mono" style={{ color: 'var(--accent)' }}>premium_user</span>
          ，密码均为{' '}
          <span className="font-mono" style={{ color: 'var(--text-soft)' }}>password123</span>
        </p>
      </div>
    </div>
  )
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="text-xs font-mono mb-1.5 block uppercase tracking-widest"
        style={{ color: 'var(--text-soft)' }}
      >
        {label}
      </label>
      {children}
    </div>
  )
}

interface RoleSelectorProps {
  form: AuthFormValues
  onSelectRole: (role: UserRole) => void
}

function RoleSelector({ form, onSelectRole }: RoleSelectorProps) {
  return (
    <div>
      <label
        className="text-xs font-mono mb-2 block uppercase tracking-widest"
        style={{ color: 'var(--text-soft)' }}
      >
        账号类型
      </label>
      <div className="grid grid-cols-2 gap-3">
        {ROLE_OPTIONS.map(({ value, icon: Icon, label, desc }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelectRole(value)}
            className="flex flex-col items-start p-3 rounded-lg border text-left transition-all duration-200"
            style={
              form.role === value
                ? {
                    border: '1px solid color-mix(in srgb, var(--accent) 55%, transparent)',
                    background: 'var(--accent-dim)',
                    boxShadow: '0 0 14px var(--accent-dim)',
                  }
                : {
                    border: '1px solid var(--bg-border)',
                    background: 'var(--bg-raised)',
                  }
            }
          >
            <Icon size={16} style={{ color: form.role === value ? 'var(--accent)' : 'var(--text-faint)' }} />
            <span
              className="text-sm font-display font-semibold mt-1.5"
              style={{ color: form.role === value ? 'var(--accent)' : 'var(--text-main)' }}
            >
              {label}
            </span>
            <span className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
