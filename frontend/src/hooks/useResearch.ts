// frontend/src/hooks/useResearch.ts
import { useState, useCallback, useRef } from 'react'
import type { AgentStatus, AgentName, ResearchSession, Source } from '../types'
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

function makeInitialAgents(): AgentStatus[] {
  return AGENT_ORDER.map(name => ({
    name,
    displayName: DISPLAY_NAMES[name],
    status: 'pending',
  }))
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
  localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_HISTORY)))
}

export function useResearch() {
  const [researchState, setResearchState] = useState<ResearchState>('idle')
  const [agents, setAgents] = useState<AgentStatus[]>(makeInitialAgents)
  const [report, setReport] = useState('')
  const [sources, setSources] = useState<Source[]>([])
  const [sourcesCount, setSourcesCount] = useState(0)
  const [history, setHistory] = useState<ResearchSession[]>(loadHistory)
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  /** Handle all progress events except __done__ */
  const handleProgressEvent = useCallback((event: SSEEvent) => {
    const { node } = event

    if (node === 'planner') {
      const total = event.sub_questions ?? 3
      setAgents(prev => prev.map(a => {
        if (a.name === 'planner') return {
          ...a, status: 'done', finishedAt: Date.now(),
          metadata: { complexity: event.complexity ?? '', subQuestions: total },
        }
        if (a.name === 'research_assistant') return {
          ...a, status: 'running', startedAt: Date.now(),
          metadata: { done: 0, total },
        }
        return a
      }))
      return
    }

    if (node === 'research_assistant') {
      setAgents(prev => prev.map(a => {
        if (a.name !== 'research_assistant') return a
        const done = ((a.metadata?.done as number) ?? 0) + 1
        const total = (a.metadata?.total as number) ?? 3
        const isLast = done >= total
        return {
          ...a,
          status: isLast ? 'done' : 'running',
          finishedAt: isLast ? Date.now() : undefined,
          metadata: { ...a.metadata, done, total },
        }
      }))
      return
    }

    if (node === 'analyst') {
      setAgents(prev => prev.map(a => {
        if (a.name === 'research_assistant' && a.status !== 'done') return { ...a, status: 'done', finishedAt: Date.now() }
        if (a.name === 'analyst') return { ...a, status: 'done', finishedAt: Date.now() }
        if (a.name === 'reviewer') return { ...a, status: 'running', startedAt: Date.now() }
        return a
      }))
      return
    }

    if (node === 'reviewer') {
      setAgents(prev => prev.map(a => {
        if (a.name === 'reviewer') return {
          ...a, status: 'done', finishedAt: Date.now(),
          metadata: { score: event.score ?? 0 },
        }
        if (a.name === 'gap_researcher') return { ...a, status: 'running', startedAt: Date.now() }
        return a
      }))
      return
    }

    if (node === 'gap_researcher') {
      setAgents(prev => prev.map(a => {
        if (a.name === 'gap_researcher') return { ...a, status: 'done', finishedAt: Date.now() }
        if (a.name === 'writer') return { ...a, status: 'running', startedAt: Date.now() }
        return a
      }))
      return
    }

    if (node === 'writer') {
      setAgents(prev => prev.map(a =>
        a.name === 'writer' ? { ...a, status: 'done', finishedAt: Date.now() } : a
      ))
    }
  }, [])

  const startResearch = useCallback(async (query: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    setResearchState('running')
    setAgents(makeInitialAgents().map((a, i) =>
      i === 0 ? { ...a, status: 'running', startedAt: Date.now() } : a
    ))
    setReport('')
    setSources([])
    setSourcesCount(0)
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

            setReport(fullReport)
            setSources(parsedSources)
            setSourcesCount(count)
            setResearchState('done')

            const session: ResearchSession = {
              id: crypto.randomUUID(),
              query,
              timestamp: Date.now(),
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
          } else {
            handleProgressEvent(event)
          }
        },
        ctrl.signal,
      )
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setError((err as Error).message ?? 'Research failed')
      setResearchState('error')
    }
  }, [handleProgressEvent])

  const loadSession = useCallback((session: ResearchSession) => {
    abortRef.current?.abort()
    setActiveSession(session)
    setReport(session.report ?? '')
    setSources(session.sources ?? [])
    setSourcesCount(session.sourcesCount ?? 0)
    setResearchState('done')
    setAgents(makeInitialAgents().map(a => ({ ...a, status: 'done' })))
    setError(null)
  }, [])

  const newResearch = useCallback(() => {
    abortRef.current?.abort()
    setResearchState('idle')
    setAgents(makeInitialAgents())
    setReport('')
    setSources([])
    setActiveSession(null)
    setError(null)
  }, [])

  return {
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
  }
}
