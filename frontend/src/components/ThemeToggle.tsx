import { useRef } from 'react'
import { Sun, Moon } from 'lucide-react'
import { animate } from 'animejs'
import { useTheme } from '../contexts/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const iconRef = useRef<HTMLSpanElement>(null)

  const handleClick = () => {
    const el = iconRef.current
    if (el) {
      animate(el, {
        rotate: [0, 360],
        scale: [1, 0.5, 1],
        duration: 400,
        ease: 'outExpo',
      })
    }
    toggleTheme()
  }

  return (
    <button
      onClick={handleClick}
      className="p-2 rounded-xl hover:bg-[#F0F4F8] dark:hover:bg-[#21262d] text-[#6B7280] dark:text-[#8b949e] transition-colors"
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <span ref={iconRef} className="block">
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </span>
    </button>
  )
}
