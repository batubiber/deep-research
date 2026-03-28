// frontend/src/components/ReportPanel.tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { FileText, BookOpen } from 'lucide-react'
import { SourceItem } from './SourceItem'
import type { Source } from '../types'
import type { ResearchState } from '../hooks/useResearch'

interface Props {
  report: string
  sources: Source[]
  sourcesCount: number
  researchState: ResearchState
  error: string | null
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-center">
        <BookOpen className="w-8 h-8 text-[#30363d]" />
      </div>
      <div>
        <p className="text-[#8b949e] text-sm font-medium">No research yet</p>
        <p className="text-[#484f58] text-xs mt-1">Submit a query to generate a report</p>
      </div>
    </div>
  )
}

function LoadingState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
      <div className="w-12 h-12 rounded-full border-2 border-[#1f6feb] border-t-transparent animate-spin" />
      <p className="text-[#8b949e] text-sm">Research in progress...</p>
      <p className="text-[#484f58] text-xs">This may take 2–3 minutes</p>
    </div>
  )
}

export function ReportPanel({ report, sources, sourcesCount, researchState, error }: Props) {
  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <p className="text-[#f85149] text-sm font-medium">Research failed</p>
        <p className="text-[#8b949e] text-xs max-w-xs text-center">{error}</p>
      </div>
    )
  }

  if (researchState === 'idle') return <EmptyState />
  if (researchState === 'running' && !report) return <LoadingState />

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Report */}
      <div className="max-w-3xl mx-auto px-6 py-6">
        {report ? (
          <div className="prose-report">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {report}
            </ReactMarkdown>
          </div>
        ) : (
          <LoadingState />
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="mt-8 pt-6 border-t border-[#30363d]">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-4 h-4 text-[#8b949e]" />
              <h3 className="text-sm font-semibold text-[#8b949e] uppercase tracking-wider">
                Sources
              </h3>
              <span className="ml-auto text-xs text-[#484f58]">
                {sources.length} of {sourcesCount} total
              </span>
            </div>
            <div className="bg-[#161b22]/60 rounded-lg border border-[#30363d] px-3">
              {sources.map((source, i) => (
                <SourceItem key={source.url + i} source={source} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
