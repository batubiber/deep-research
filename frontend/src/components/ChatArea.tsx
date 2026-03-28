import { useRef, useEffect, useCallback } from 'react'
import { FlaskConical } from 'lucide-react'
import { UserMessage } from './UserMessage'
import { AgentMessage } from './AgentMessage'
import { ChatInput } from './ChatInput'
import type { ChatMessage } from '../types'

interface Props {
  messages: ChatMessage[]
  error: string | null
  onSendMessage: (query: string) => void
  isRunning: boolean
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-[#161b22] border border-[#30363d] flex items-center justify-center">
        <FlaskConical className="w-8 h-8 text-[#30363d]" />
      </div>
      <div>
        <p className="text-[#8b949e] text-sm font-medium">Deep Research</p>
        <p className="text-[#484f58] text-xs mt-1">Send a message to start a research conversation</p>
      </div>
    </div>
  )
}

export function ChatArea({ messages, error, onSendMessage, isRunning }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isNearBottom = useRef(true)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    isNearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const lastMsgStatus = messages.length > 0 ? messages[messages.length - 1].status : undefined
  useEffect(() => {
    if (isNearBottom.current && scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages.length, lastMsgStatus])

  const hasMessages = messages.length > 0

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Message list */}
      {hasMessages ? (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto"
        >
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map(msg => {
              if (msg.role === 'user') {
                return <UserMessage key={msg.id} query={msg.data.query ?? ''} />
              }
              // Skip __done__ without report
              if (!msg.agentName && msg.data?.node === '__done__' && !msg.data?.report) {
                return null
              }
              // Skip writer agent message (the __done__ message renders the report)
              if (msg.agentName === 'writer' && msg.status === 'done' && !msg.data?.report) {
                return null
              }
              return <AgentMessage key={msg.id} message={msg} />
            })}

            {error && (
              <div className="flex gap-3 animate-message-enter">
                <div className="w-8 h-8 rounded-full bg-[#3d1218] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FlaskConical className="w-4 h-4 text-[#f85149]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-[#f85149] font-medium">Research failed</p>
                  <p className="text-xs text-[#8b949e] mt-1">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <EmptyState />
      )}

      {/* Input */}
      <ChatInput onSend={onSendMessage} isRunning={isRunning} />
    </div>
  )
}
