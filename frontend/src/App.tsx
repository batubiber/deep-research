import { useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { useResearch } from './hooks/useResearch'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showHero, setShowHero] = useState(true)
  const [showShader, setShowShader] = useState(true)
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

  // Once messages appear, leave hero permanently
  const hasMessages = messages.length > 0
  if (hasMessages && showHero) setShowHero(false)

  return (
    <div className="flex h-screen overflow-hidden bg-black antialiased">
      {!showHero && (
        <Sidebar
          history={history}
          activeId={activeSession?.id}
          onSelect={loadSession}
          onNew={newResearch}
          onDelete={deleteSession}
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(prev => !prev)}
          showShader={showShader}
          onToggleShader={() => setShowShader(prev => !prev)}
        />
      )}
      <ChatArea
        messages={messages}
        error={error}
        onSendMessage={startResearch}
        onStop={stopResearch}
        onNew={newResearch}
        isRunning={researchState === 'running'}
        showHero={showHero}
        onHeroEnter={() => setShowHero(false)}
        showShader={showShader}
      />
    </div>
  )
}
