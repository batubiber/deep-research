import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { useResearch } from './hooks/useResearch'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const {
    researchState,
    messages,
    history,
    activeSession,
    error,
    startResearch,
    stopResearch,
    loadSession,
    newResearch,
    deleteSession,
  } = useResearch()

  return (
    <div className="flex h-screen overflow-hidden bg-[var(--neu-bg)] antialiased">
      <Sidebar
        history={history}
        activeId={activeSession?.id}
        onSelect={loadSession}
        onNew={newResearch}
        onDelete={deleteSession}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(prev => !prev)}
      />
      <ChatArea
        messages={messages}
        error={error}
        onSendMessage={startResearch}
        onStop={stopResearch}
        onNew={newResearch}
        isRunning={researchState === 'running'}
      />
    </div>
  )
}
