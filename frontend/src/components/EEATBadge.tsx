// frontend/src/components/EEATBadge.tsx
import type { EEATScore } from '../types'

const CONFIG: Record<EEATScore, { label: string; className: string }> = {
  high:   { label: 'high',   className: 'bg-[#1a4731] text-[#3fb950] border border-[#2ea043]/40' },
  medium: { label: 'medium', className: 'bg-[#3d2e00] text-[#d29922] border border-[#d29922]/40' },
  low:    { label: 'low',    className: 'bg-[#21262d] text-[#8b949e] border border-[#30363d]' },
}

export function EEATBadge({ score }: { score: EEATScore }) {
  const { label, className } = CONFIG[score]
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium leading-none ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label}
    </span>
  )
}
