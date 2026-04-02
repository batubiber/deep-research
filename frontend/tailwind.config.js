import defaultTheme from 'tailwindcss/defaultTheme'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        neu: {
          bg: 'var(--neu-bg)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          glow: 'var(--color-primary-glow)',
        },
      },
      boxShadow: {
        'neu-raised': 'var(--neu-raised)',
        'neu-raised-sm': 'var(--neu-raised-sm)',
        'neu-raised-lg': 'var(--neu-raised-lg)',
        'neu-pressed': 'var(--neu-pressed)',
        'neu-pressed-deep': 'var(--neu-pressed-deep)',
        'neu-flat': 'var(--neu-flat)',
      },
      backdropBlur: {
        glass: '16px',
      },
      borderRadius: {
        'neu': '16px',
        'neu-sm': '12px',
        'neu-lg': '20px',
      },
    },
  },
  plugins: [],
}
