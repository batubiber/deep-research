// frontend/src/components/AgentCard.tsx
import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2, AlertCircle } from 'lucide-react'
import type { AgentStatus } from '../types'

function useElapsed(startedAt?: number, finishedAt?: number): string {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (!startedAt || finishedAt) return
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [startedAt, finishedAt])

  if (!startedAt) return ''
  const ms = (finishedAt ?? now) - startedAt
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

const RUNNING_LABELS: Record<string, string> = {
  planner: 'Decomposing query...',
  research_assistant: 'Searching...',
  analyst: 'Synthesizing sources...',
  reviewer: 'Reviewing analysis...',
  gap_researcher: 'Filling knowledge gaps...',
  writer: 'Writing final report...',
}

function AgentMetadata({ agent }: { agent: AgentStatus }) {
  const { name, metadata } = agent
  if (!metadata) return null

  if (name === 'planner') {
    const complexity = metadata.complexity as string
    const subQ = metadata.subQuestions as number
    const colors: Record<string, string> = {
      simple: 'text-[#3fb950]', moderate: 'text-[#d29922]', complex: 'text-[#f85149]',
    }
    return (
      <div className="flex items-center gap-2 mt-1">
        {complexity && (
          <span className={`text-[10px] font-medium capitalize ${colors[complexity] ?? 'text-[#8b949e]'}`}>
            {complexity}
          </span>
        )}
        {subQ > 0 && (
          <span className="text-[10px] text-[#8b949e]">{subQ} sub-questions</span>
        )}
      </div>
    )
  }

  if (name === 'research_assistant') {
    const done = metadata.done as number ?? 0
    const total = metadata.total as number ?? 3
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return (
      <div className="mt-1.5">
        <div className="flex justify-between text-[10px] text-[#8b949e] mb-1">
          <span>{done} / {total} searches</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1 bg-[#21262d] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#1f6feb] to-[#388bfd] rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  if (name === 'reviewer') {
    const score = metadata.score as number
    if (!score) return null
    const color =
      score >= 8 ? 'text-[#3fb950] bg-[#1a4731]' :
      score >= 5 ? 'text-[#d29922] bg-[#3d2e00]' :
                   'text-[#f85149] bg-[#3d1218]'
    return (
      <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${color}`}>
        {score}/10
      </span>
    )
  }

  return null
}

export function AgentCard({ agent }: { agent: AgentStatus }) {
  const { status, startedAt, finishedAt } = agent
  const elapsed = useElapsed(startedAt, finishedAt)

  const borderColor =
    status === 'done'    ? 'border-[#2ea043]/30' :
    status === 'running' ? 'border-[#388bfd]/40' :
    status === 'error'   ? 'border-[#f85149]/40' :
                           'border-[#30363d]'

  const bgColor =
    status === 'done'    ? 'bg-[#3fb950]/5' :
    status === 'running' ? 'bg-[#388bfd]/5' :
    status === 'error'   ? 'bg-[#f85149]/5' :
                           'bg-transparent'

  return (
    <div className={`px-3 py-2.5 rounded-lg border transition-all duration-300 ${borderColor} ${bgColor}`}>
      <div className="flex items-center gap-2.5">
        {status === 'pending' && <Circle className="w-4 h-4 text-[#484f58] flex-shrink-0" />}
        {status === 'running' && <Loader2 className="w-4 h-4 text-[#58a6ff] flex-shrink-0 animate-spin" />}
        {status === 'done'    && <CheckCircle2 className="w-4 h-4 text-[#3fb950] flex-shrink-0" />}
        {status === 'error'   && <AlertCircle className="w-4 h-4 text-[#f85149] flex-shrink-0" />}

        <span className={`text-sm font-medium flex-1 ${
          status === 'pending' ? 'text-[#484f58]' :
          status === 'running' ? 'text-[#58a6ff]' :
          status === 'done'    ? 'text-[#e6edf3]' :
                                 'text-[#f85149]'
        }`}>
          {agent.displayName}
        </span>

        {elapsed && (
          <span className={`text-[10px] flex-shrink-0 ${status === 'done' ? 'text-[#3fb950]' : 'text-[#8b949e]'}`}>
            {elapsed}
          </span>
        )}
      </div>

      {status === 'running' && !agent.metadata && (
        <p className="text-[11px] text-[#8b949e] mt-1 ml-[26px]">
          {RUNNING_LABELS[agent.name] ?? 'Processing...'}
        </p>
      )}

      {(status === 'running' || status === 'done') && agent.metadata && (
        <div className="ml-[26px]">
          <AgentMetadata agent={agent} />
        </div>
      )}
    </div>
  )
}
