import { Eye, EyeOff, Zap, User } from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '@/hooks/useAuth'
import type { AuthMode, AuthFormValues } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

// ── 角色选择器配置 ────
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

// ── 标签页文字 ────
const MODE_LABELS: Record<AuthMode, string> = {
  login: '登录',
  register: '注册',
}

// ── 主组件 ────
export default function AuthPage() {
  const {
    mode,
    form,
    showPassword,
    loading,
    error,
    setField,
    setRole,
    switchMode,
    toggleShowPassword,
    handleSubmit,
  } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-carbon relative overflow-hidden">
      {/* 背景网格 */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(#f59e0b 1px,transparent 1px),linear-gradient(90deg,#f59e0b 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
      {/* 发光光晕 */}
      <div className="absolute top-1/4 left-1/3 w-72 h-72 rounded-full bg-amber/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-amber/4 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md px-4 animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber/10 border border-amber/20 mb-4 shadow-amber-glow">
            <Zap size={24} className="text-amber" />
          </div>
          <h1 className="font-display text-3xl font-bold text-ice tracking-tight">智能问答系统</h1>
          <p className="text-slate-soft text-sm mt-1.5">由 Claude AI 驱动</p>
        </div>

        {/* 模式切换 */}
        <div className="flex bg-carbon-50 rounded-xl p-1 border border-carbon-300 mb-6">
          {(Object.keys(MODE_LABELS) as AuthMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={clsx(
                'flex-1 py-2 text-sm font-display font-semibold rounded-lg transition-all duration-200',
                mode === m
                  ? 'bg-amber text-carbon shadow-amber-glow'
                  : 'text-slate-soft hover:text-ice',
              )}
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
            <div className="animate-fade-up">
            </div>
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
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-muted hover:text-amber transition-colors"
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
            <p className="text-ruby-pill text-sm bg-ruby-dim border border-ruby-pill/20 rounded-lg px-3 py-2 animate-fade-in">
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

        {/* 演示账号提示 */}
        <p className="text-center text-xs text-slate-faint mt-5">
          演示账号：<span className="text-slate-muted font-mono">normal_user</span> 或{' '}
          <span className="text-amber font-mono">premium_user</span>，密码均为{' '}
          <span className="font-mono text-slate-muted">password123</span>
        </p>
      </div>
    </div>
  )
}

// ── 辅助组件 ───
function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-mono text-slate-soft mb-1.5 block uppercase tracking-widest">
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
      <label className="text-xs font-mono text-slate-soft mb-2 block uppercase tracking-widest">
        账号类型
      </label>
      <div className="grid grid-cols-2 gap-3">
        {ROLE_OPTIONS.map(({ value, icon: Icon, label, desc }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSelectRole(value)}
            className={clsx(
              'flex flex-col items-start p-3 rounded-lg border text-left transition-all duration-200',
              form.role === value
                ? 'border-amber bg-amber/8 shadow-amber-glow'
                : 'border-carbon-400 bg-carbon-200 hover:border-carbon-400/80',
            )}
          >
            <Icon size={16} className={form.role === value ? 'text-amber' : 'text-slate-muted'} />
            <span
              className={clsx(
                'text-sm font-display font-semibold mt-1.5',
                form.role === value ? 'text-amber' : 'text-ice',
              )}
            >
              {label}
            </span>
            <span className="text-xs text-slate-muted mt-0.5">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}