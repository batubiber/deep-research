// frontend/src/App.tsx
import { SearchBar } from './components/SearchBar'
import { Sidebar } from './components/Sidebar'
import { PipelinePanel } from './components/PipelinePanel'
import { ReportPanel } from './components/ReportPanel'
import { useResearch } from './hooks/useResearch'
import { FlaskConical } from 'lucide-react'

export default function App() {
  const {
    researchState,
    agents,
    report,
    sources,
    sourcesCount,
    history,
    activeSession,
    error,
    startResearch,
    loadSession,
    newResearch,
  } = useResearch()

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#0d1117]">

      {/* Header */}
      <header className="flex items-center px-4 h-12 border-b border-[#30363d] bg-[#161b22]/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-[#58a6ff]" />
          <span className="text-sm font-bold text-[#e6edf3] tracking-wide">DeepResearch</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#21262d] border border-[#30363d] text-[#8b949e] font-mono">
            qwen3-5
          </span>
        </div>
      </header>

      {/* Search bar */}
      <div className="px-4 py-3 border-b border-[#30363d] bg-[#161b22]/40 flex-shrink-0">
        <SearchBar
          onSearch={startResearch}
          isRunning={researchState === 'running'}
        />
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          history={history}
          activeId={activeSession?.id}
          onSelect={loadSession}
          onNew={newResearch}
        />
        <PipelinePanel
          agents={agents}
          researchState={researchState}
        />
        <ReportPanel
          report={report}
          sources={sources}
          sourcesCount={sourcesCount}
          researchState={researchState}
          error={error}
        />
      </div>
    </div>
  )
}
