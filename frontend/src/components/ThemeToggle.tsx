import { Moon, Sun } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore()

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
      aria-label={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
    >
      <span className="theme-toggle-thumb" />
      <span className="theme-toggle-icon theme-toggle-icon-moon">
        <Moon size={10} />
      </span>
      <span className="theme-toggle-icon theme-toggle-icon-sun">
        <Sun size={10} />
      </span>
    </button>
  )
}
