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
        <div className="neu-raised-sm px-5 py-3.5 bg-[var(--neu-bg)]">
          <p className="text-[var(--color-text-primary)] text-sm leading-relaxed whitespace-pre-wrap">{query}</p>
        </div>
        <button
          className="absolute -top-1.5 -right-1.5 p-1.5 neu-btn opacity-0 group-hover:opacity-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] transition-all"
          title="Edit"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
