// frontend/src/components/SourceItem.tsx
import { ExternalLink } from 'lucide-react'
import { EEATBadge } from './EEATBadge'
import type { Source } from '../types'

export function SourceItem({ source, index }: { source: Source; index: number }) {
  const hostname = (() => {
    try { return new URL(source.url).hostname } catch { return source.url }
  })()

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[#21262d] last:border-0">
      <span className="text-[11px] text-[#484f58] font-mono w-5 flex-shrink-0 mt-0.5">
        {index + 1}.
      </span>
      <div className="flex-1 min-w-0">
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-1 group"
        >
          <span className="text-sm text-[#58a6ff] group-hover:text-[#79c0ff] line-clamp-2 leading-snug">
            {source.title}
          </span>
          <ExternalLink className="w-3 h-3 flex-shrink-0 mt-0.5 text-[#58a6ff] opacity-60" />
        </a>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] text-[#8b949e] truncate">{hostname}</span>
          <EEATBadge score={source.eet_score} />
        </div>
      </div>
    </div>
  )
}
