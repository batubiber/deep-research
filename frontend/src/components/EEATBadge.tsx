import type { EEATScore } from '../types'

const CONFIG: Record<EEATScore, { label: string; className: string }> = {
  high:   { label: 'high',   className: 'bg-green-50 text-green-700 border border-green-200 dark:bg-[#1a4731] dark:text-[#3fb950] dark:border-[#2ea043]/40' },
  medium: { label: 'medium', className: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-[#3d2e00] dark:text-[#d29922] dark:border-[#d29922]/40' },
  low:    { label: 'low',    className: 'bg-gray-100 text-gray-500 border border-gray-200 dark:bg-[#21262d] dark:text-[#8b949e] dark:border-[#30363d]' },
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
