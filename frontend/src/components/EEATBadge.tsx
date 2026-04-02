import type { EEATScore } from '../types'

const CONFIG: Record<EEATScore, { label: string; dot: string; className: string }> = {
  high: {
    label: 'high',
    dot: 'bg-emerald-400',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  },
  medium: {
    label: 'medium',
    dot: 'bg-amber-400',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
  },
  low: {
    label: 'low',
    dot: 'bg-gray-400',
    className: 'bg-gray-500/10 text-[var(--color-text-tertiary)] border border-gray-500/15',
  },
}

export function EEATBadge({ score }: { score: EEATScore }) {
  const { label, dot, className } = CONFIG[score]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold leading-none backdrop-blur-sm ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
