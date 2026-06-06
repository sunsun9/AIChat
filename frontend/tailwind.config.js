/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
    theme: {
      extend: {
        fontFamily: {
          display: ['"Syne"', 'sans-serif'],
          body: ['"DM Sans"', 'sans-serif'],
          mono: ['"JetBrains Mono"', 'monospace'],
        },
        colors: {
          // Core palette
          carbon:  { DEFAULT: '#0f0f11', 50: '#1a1a1f', 100: '#141418', 200: '#1e1e24', 300: '#28282f', 400: '#38383f' },
          amber:   { DEFAULT: '#f59e0b', light: '#fcd34d', dark: '#b45309', glow: 'rgba(245,158,11,0.15)' },
          slate:   { soft: '#94a3b8', muted: '#64748b', faint: '#334155' },
          emerald: { pill: '#10b981', dim: 'rgba(16,185,129,0.15)' },
          ruby:    { pill: '#f43f5e', dim: 'rgba(244,63,94,0.12)' },
          ice:     { DEFAULT: '#e2e8f0', dim: '#cbd5e1' },
        },
        animation: {
          'fade-up':    'fadeUp 0.4s ease both',
          'fade-in':    'fadeIn 0.3s ease both',
          'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
          'shimmer':    'shimmer 1.5s linear infinite',
          'slide-in':   'slideIn 0.35s cubic-bezier(0.16,1,0.3,1) both',
        },
        keyframes: {
          fadeUp:    { from: { opacity: 0, transform: 'translateY(12px)' }, to: { opacity: 1, transform: 'none' } },
          fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
          pulseSoft: { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.4 } },
          shimmer:   { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
          slideIn:   { from: { opacity: 0, transform: 'translateX(-16px)' }, to: { opacity: 1, transform: 'none' } },
        },
        boxShadow: {
          'amber-glow': '0 0 20px rgba(245,158,11,0.2)',
          'card':       '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
          'panel':      '0 4px 24px rgba(0,0,0,0.5)',
        },
      },
    },
    plugins: [],
  }
  