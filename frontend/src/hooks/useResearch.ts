// frontend/src/hooks/useResearch.ts
import { useState, useCallback, useRef, useMemo } from 'react'
import type { AgentName, ChatMessage, ResearchSession, Source } from '../types'
import { streamResearch, type SSEEvent } from '../lib/api'
import { parseSources } from '../lib/parseReport'

export type ResearchState = 'idle' | 'running' | 'done' | 'error'

const AGENT_ORDER: AgentName[] = [
  'planner', 'research_assistant', 'analyst', 'reviewer', 'gap_researcher', 'writer',
]

const DISPLAY_NAMES: Record<AgentName, string> = {
  planner: 'Planner',
  research_assistant: 'Researcher',
  analyst: 'Analyst',
  reviewer: 'Reviewer',
  gap_researcher: 'Gap Researcher',
  writer: 'Writer',
}

function nextAgent(current: AgentName): AgentName | null {
  const idx = AGENT_ORDER.indexOf(current)
  return idx >= 0 && idx < AGENT_ORDER.length - 1 ? AGENT_ORDER[idx + 1] : null
}

const HISTORY_KEY = 'deep-research-history'
const MAX_HISTORY = 20

function loadHistory(): ResearchSession[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as ResearchSession[]
  } catch {
    return []
  }
}

function persistHistory(sessions: ResearchSession[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_HISTORY)))
  } catch {
    // QuotaExceededError — silently ignore
  }
}

function trimMessagesForStorage(messages: ChatMessage[]): ChatMessage[] {
  return messages.map(m => {
    if (m.role === 'user') return m
    const data = { ...m.data }
    // Trim source content fields to save localStorage space
    if (data.sources) {
      data.sources = data.sources.map((s: any) => ({ ...s, content: s.content?.slice(0, 200) ?? '' }))
    }
    if (data.gap_sources) {
      data.gap_sources = data.gap_sources.map((s: any) => ({ ...s, content: s.content?.slice(0, 200) ?? '' }))
    }
    return { ...m, data }
  })
}

export function useResearch() {
  const [researchState, setResearchState] = useState<ResearchState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [history, setHistory] = useState<ResearchSession[]>(loadHistory)
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const researcherCountRef = useRef({ done: 0, total: 0 })

  // Derive report and sources from messages
  const { report, sources, sourcesCount } = useMemo(() => {
    const doneMsg = messages.find(m => m.data?.node === '__done__')
    if (doneMsg) {
      const rep = doneMsg.data.report ?? ''
      const parsed = parseSources(rep)
      return { report: rep, sources: parsed, sourcesCount: doneMsg.data.sources_count ?? parsed.length }
    }
    return { report: '', sources: [] as Source[], sourcesCount: 0 }
  }, [messages])

  const handleEvent = useCallback((event: SSEEvent) => {
    if (event.node === '__done__') {
      // Add a synthetic done message with the report
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'agent' as const,
          status: 'done' as const,
          data: event,
        },
      ])
      return
    }

    const agentName = event.node as AgentName
    const now = Date.now()

    setMessages(prev => {
      const updated = [...prev]

      if (agentName === 'research_assistant') {
        // Each researcher event is a separate message
        // Find the running placeholder and update it, or handle completed ones
        const runningIdx = updated.findIndex(
          m => m.agentName === 'research_assistant' && m.status === 'running'
        )

        if (runningIdx >= 0) {
          // Update the running placeholder to done with data
          updated[runningIdx] = {
            ...updated[runningIdx],
            status: 'done',
            finishedAt: now,
            data: event,
          }
        } else {
          // No running placeholder — add completed directly
          updated.push({
            id: crypto.randomUUID(),
            role: 'agent',
            agentName: 'research_assistant',
            displayName: DISPLAY_NAMES.research_assistant,
            status: 'done',
            startedAt: now,
            finishedAt: now,
            data: event,
          })
        }

        researcherCountRef.current.done += 1
        const { done, total } = researcherCountRef.current

        if (done < total) {
          // Add next researcher placeholder
          updated.push({
            id: crypto.randomUUID(),
            role: 'agent',
            agentName: 'research_assistant',
            displayName: DISPLAY_NAMES.research_assistant,
            status: 'running',
            startedAt: now,
            data: {},
          })
        } else {
          // All researchers done — start analyst
          updated.push({
            id: crypto.randomUUID(),
            role: 'agent',
            agentName: 'analyst',
            displayName: DISPLAY_NAMES.analyst,
            status: 'running',
            startedAt: now,
            data: {},
          })
        }

        return updated
      }

      // For non-researcher agents: find the running message and mark done
      const runningIdx = updated.findIndex(
        m => m.agentName === agentName && m.status === 'running'
      )

      if (runningIdx >= 0) {
        updated[runningIdx] = {
          ...updated[runningIdx],
          status: 'done',
          finishedAt: now,
          data: event,
        }
      }

      // Special: planner done → set researcher count and start first researcher
      if (agentName === 'planner') {
        const subQs = event.sub_questions ?? []
        researcherCountRef.current = { done: 0, total: subQs.length || 3 }
        updated.push({
          id: crypto.randomUUID(),
          role: 'agent',
          agentName: 'research_assistant',
          displayName: DISPLAY_NAMES.research_assistant,
          status: 'running',
          startedAt: now,
          data: {},
        })
      } else if (agentName !== 'writer') {
        // Start the next agent in the pipeline
        const next = nextAgent(agentName)
        if (next && next !== 'research_assistant') {
          updated.push({
            id: crypto.randomUUID(),
            role: 'agent',
            agentName: next,
            displayName: DISPLAY_NAMES[next],
            status: 'running',
            startedAt: now,
            data: {},
          })
        }
      }

      return updated
    })
  }, [])

  const startResearch = useCallback(async (query: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    researcherCountRef.current = { done: 0, total: 0 }

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      status: 'done',
      data: { query },
    }

    const plannerMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'agent',
      agentName: 'planner',
      displayName: DISPLAY_NAMES.planner,
      status: 'running',
      startedAt: Date.now(),
      data: {},
    }

    setResearchState('running')
    setMessages([userMsg, plannerMsg])
    setError(null)
    setActiveSession(null)

    try {
      await streamResearch(
        query,
        (event) => {
          if (event.node === '__done__') {
            const fullReport = event.report ?? ''
            const parsedSources = parseSources(fullReport)
            const count = event.sources_count ?? parsedSources.length

            setResearchState('done')

            setMessages(prev => {
              const withDone = [...prev, {
                id: crypto.randomUUID(),
                role: 'agent' as const,
                status: 'done' as const,
                data: event,
              }]

              const session: ResearchSession = {
                id: crypto.randomUUID(),
                query,
                timestamp: Date.now(),
                messages: trimMessagesForStorage(withDone),
                report: fullReport,
                sources: parsedSources,
                sourcesCount: count,
              }
              setActiveSession(session)
              setHistory(prev => {
                const updated = [session, ...prev].slice(0, MAX_HISTORY)
                persistHistory(updated)
                return updated
              })

              return withDone
            })
          } else {
            handleEvent(event)
          }
        },
        ctrl.signal,
      )
      // Only set error if __done__ was never received (state still 'running')
      setResearchState(prev => {
        if (prev === 'running') {
          setError('Research stream closed without a final report')
          return 'error'
        }
        return prev
      })
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message ?? 'Research failed')
      setResearchState('error')
    }
  }, [handleEvent])

  const loadSession = useCallback((session: ResearchSession) => {
    abortRef.current?.abort()
    setActiveSession(session)
    setResearchState('done')
    setError(null)

    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages)
    } else {
      // Legacy session — synthesize minimal messages
      const msgs: ChatMessage[] = [
        {
          id: crypto.randomUUID(),
          role: 'user',
          status: 'done',
          data: { query: session.query },
        },
      ]
      if (session.report) {
        msgs.push({
          id: crypto.randomUUID(),
          role: 'agent',
          agentName: 'writer',
          displayName: DISPLAY_NAMES.writer,
          status: 'done',
          data: {
            node: '__done__',
            report: session.report,
            sources_count: session.sourcesCount ?? 0,
          },
        })
      }
      setMessages(msgs)
    }
  }, [])

  const newResearch = useCallback(() => {
    abortRef.current?.abort()
    setResearchState('idle')
    setMessages([])
    setActiveSession(null)
    setError(null)
  }, [])

  return {
    researchState,
    messages,
    report,
    sources,
    sourcesCount,
    history,
    activeSession,
    error,
    startResearch,
    loadSession,
    newResearch,
  }
}
