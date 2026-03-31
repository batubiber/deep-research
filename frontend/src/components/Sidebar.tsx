import { PlusCircle, Clock, Trash2 } from 'lucide-react'
import type { ResearchSession } from '../types'

interface Props {
  history: ResearchSession[]
  activeId?: string
  onSelect: (session: ResearchSession) => void
  onNew: () => void
  onDelete: (id: string) => void
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - ts) / 86400000)
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function Sidebar({ history, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <div className="w-56 flex-shrink-0 border-r border-[#30363d] bg-[#0d1117] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 py-3 border-b border-[#30363d]">
        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#161b22] hover:bg-[#21262d] border border-[#30363d] text-sm text-[#e6edf3] font-medium transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-[#58a6ff]" />
          New Research
        </button>
      </div>

      {/* History label */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center gap-1.5 text-[10px] text-[#484f58] uppercase tracking-wider font-semibold">
          <Clock className="w-3 h-3" />
          History
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {history.length === 0 ? (
          <p className="text-[#484f58] text-xs text-center py-6 px-3">
            Past research sessions will appear here
          </p>
        ) : (
          history.map(session => (
            <div
              key={session.id}
              className={`relative rounded-lg mb-1 group ${
                session.id === activeId
                  ? 'bg-[#1f6feb]/15 border border-[#388bfd]/30'
                  : 'hover:bg-[#161b22] border border-transparent'
              }`}
            >
              <button
                onClick={() => onSelect(session)}
                className="w-full text-left px-3 py-2.5 pr-8"
              >
                <p className={`text-xs font-medium line-clamp-2 leading-snug ${
                  session.id === activeId ? 'text-[#79c0ff]' : 'text-[#c9d1d9] group-hover:text-[#e6edf3]'
                }`}>
                  {session.query}
                </p>
                <p className="text-[10px] text-[#484f58] mt-1">
                  {formatDate(session.timestamp)}
                </p>
              </button>
              <button
                onClick={e => { e.stopPropagation(); onDelete(session.id) }}
                className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[#3d1218] text-[#484f58] hover:text-[#f85149] transition-all"
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
