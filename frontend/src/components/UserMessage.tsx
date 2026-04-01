import { useRef, useLayoutEffect } from 'react'
import { Pencil } from 'lucide-react'
import { animate } from 'animejs'

interface Props {
  query: string
}

export function UserMessage({ query }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.opacity = '0'
    el.style.transform = 'translateX(24px)'
    animate(el, {
      opacity: [0, 1],
      translateX: [24, 0],
      duration: 450,
      ease: 'outExpo',
    })
  }, [])

  return (
    <div ref={ref} className="flex justify-end group">
      <div className="relative max-w-[80%]">
        <div className="bg-[#F0F4F8] dark:bg-[#161b22] rounded-2xl px-4 py-3">
          <p className="text-[#1A1A2E] dark:text-[#e6edf3] text-sm leading-relaxed whitespace-pre-wrap">{query}</p>
        </div>
        <button
          className="absolute -top-1 -right-1 p-1 rounded-lg bg-white dark:bg-[#21262d] border border-[#E5E7EB] dark:border-[#30363d] opacity-0 group-hover:opacity-100 text-[#9CA3AF] hover:text-[#6B7280] dark:text-[#484f58] dark:hover:text-[#8b949e] transition-all shadow-sm dark:shadow-none"
          title="Edit"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
