// frontend/src/components/PipelinePanel.tsx
import { AgentCard } from './AgentCard'
import type { AgentStatus } from '../types'
import type { ResearchState } from '../hooks/useResearch'

interface Props {
  agents: AgentStatus[]
  researchState: ResearchState
}

export function PipelinePanel({ agents, researchState }: Props) {
  return (
    <div className="w-72 flex-shrink-0 border-r border-[#30363d] bg-[#0d1117] flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[#30363d]">
        <h2 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">Pipeline</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {researchState === 'idle' ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[#484f58] text-sm text-center px-4">
              Submit a query to start the research pipeline
            </p>
          </div>
        ) : (
          agents.map(agent => (
            <AgentCard key={agent.name} agent={agent} />
          ))
        )}
      </div>

      {researchState === 'done' && (
        <div className="px-3 py-2 border-t border-[#30363d]">
          <div className="flex items-center gap-1.5 text-xs text-[#3fb950]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950]" />
            Research complete
          </div>
        </div>
      )}

      {researchState === 'running' && (
        <div className="px-3 py-2 border-t border-[#30363d]">
          <div className="flex items-center gap-1.5 text-xs text-[#58a6ff]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#58a6ff] animate-pulse" />
            Running...
          </div>
        </div>
      )}
    </div>
  )
}
