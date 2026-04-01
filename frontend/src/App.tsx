import { Sidebar } from './components/Sidebar'
import { ChatArea } from './components/ChatArea'
import { useResearch } from './hooks/useResearch'

export default function App() {
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
    <div className="flex h-screen overflow-hidden bg-[#F5F5F5] dark:bg-[#0d1117]">
      <Sidebar
        history={history}
        activeId={activeSession?.id}
        onSelect={loadSession}
        onNew={newResearch}
        onDelete={deleteSession}
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
