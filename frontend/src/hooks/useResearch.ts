// frontend/src/hooks/useResearch.ts
import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import type { AgentName, ChatMessage, ResearchSession, Source } from '../types'
import { startTask, streamTaskEvents, cancelTask, getTaskStatus, type SSEEvent, type StreamHandle } from '../lib/api'
import { parseSources } from '../lib/parseReport'
import { useSessionStore } from './useSessionStore'

export type ResearchState = 'idle' | 'running' | 'done' | 'error'

const AGENT_ORDER: AgentName[] = [
  'planner', 'research_assistant', 'analyst', 'reviewer', 'gap_researcher', 'writer',
]

const DISPLAY_NAMES: Record<AgentName, string> = {
  planner: 'Planner',
  research_assistant: 'Researcher',
  summarizer: 'Summarizer',
  analyst: 'Analyst',
  reviewer: 'Reviewer',
  gap_researcher: 'Gap Researcher',
  gap_integrator: 'Gap Integrator',
  writer: 'Writer',
  citation_verifier: 'Citation Verifier',
}

function nextAgent(current: AgentName): AgentName | null {
  const idx = AGENT_ORDER.indexOf(current)
  return idx >= 0 && idx < AGENT_ORDER.length - 1 ? AGENT_ORDER[idx + 1] : null
}

const ACTIVE_TASK_KEY = 'deep-research-active-task'

function saveActiveTask(taskId: string, query: string): void {
  localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify({ taskId, query }))
}

function loadActiveTask(): { taskId: string; query: string } | null {
  try {
    const raw = localStorage.getItem(ACTIVE_TASK_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearActiveTask(): void {
  localStorage.removeItem(ACTIVE_TASK_KEY)
}


export function useResearch() {
  const { sessions: history, isLoading: historyLoading, addSession, removeSession } = useSessionStore()
  const [researchState, setResearchState] = useState<ResearchState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [activeSession, setActiveSession] = useState<ResearchSession | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const taskIdRef = useRef<string | null>(null)
  const lastEventIdRef = useRef<number>(0)
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
    if (event.node === '__cancelled__') {
      setResearchState('idle')
      setError('Research was cancelled')
      clearActiveTask()
      return
    }

    if (event.node === '__error__') {
      setError(event.error ?? 'Research failed')
      setResearchState('error')
      clearActiveTask()
      taskIdRef.current = null
      setMessages(prev => prev.map(m =>
        m.status === 'running' ? { ...m, status: 'error' as const, finishedAt: Date.now() } : m
      ))
      return
    }

    if (event.node === '__done__') {
      const fullReport = event.report ?? ''
      const parsedSources = parseSources(fullReport)
      const count = event.sources_count ?? parsedSources.length

      setResearchState('done')
      clearActiveTask()

      setMessages(prev => {
        const withDone = [...prev, {
          id: crypto.randomUUID(),
          role: 'agent' as const,
          status: 'done' as const,
          data: event,
        }]

        const query = prev.find(m => m.role === 'user')?.data?.query ?? ''

        const session: ResearchSession = {
          id: crypto.randomUUID(),
          query,
          timestamp: Date.now(),
          messages: withDone,
          report: fullReport,
          sources: parsedSources,
          sourcesCount: count,
        }
        setActiveSession(session)
        addSession(session)

        return withDone
      })
      return
    }

    const agentName = event.node as AgentName
    const now = Date.now()

    setMessages(prev => {
      const updated = [...prev]

      if (agentName === 'research_assistant') {
        const runningIdx = updated.findIndex(
          m => m.agentName === 'research_assistant' && m.status === 'running'
        )

        if (runningIdx >= 0) {
          updated[runningIdx] = {
            ...updated[runningIdx],
            status: 'done',
            finishedAt: now,
            data: event,
          }
        } else {
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
        researcherCountRef.current = { done: 0, total: subQs.length }
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
  }, [addSession])

  // -----------------------------------------------------------------------
  // Connect to a task's event stream with auto-reconnect
  // -----------------------------------------------------------------------
  const connectToTask = useCallback(async (taskId: string, _query?: string) => {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    taskIdRef.current = taskId

    const MAX_RECONNECTS = 10
    const BASE_DELAY = 1000 // 1s, doubles each attempt

    for (let attempt = 0; attempt <= MAX_RECONNECTS; attempt++) {
      if (ctrl.signal.aborted) return

      try {
        const handle: StreamHandle = await streamTaskEvents(
          taskId, handleEvent, ctrl.signal, lastEventIdRef.current,
        )
        lastEventIdRef.current = handle.lastEventId

        // Stream ended gracefully — check if research is done
        const status = await getTaskStatus(taskId).catch(() => null)
        if (!status || status.done) {
          // Task finished — if we never got __done__, emit error
          setResearchState(prev => {
            if (prev === 'running') {
              setError('Research stream closed without a final report')
              clearActiveTask()
              taskIdRef.current = null
              setMessages(msgs => msgs.map(m =>
                m.status === 'running' ? { ...m, status: 'error' as const, finishedAt: Date.now() } : m
              ))
              return 'error'
            }
            return prev
          })
          return
        }

        // Task still running but stream dropped (tab switch, network blip) — reconnect
        const delay = Math.min(BASE_DELAY * 2 ** attempt, 15000)
        await new Promise(r => setTimeout(r, delay))
        continue
      } catch (err) {
        if ((err as Error).name === 'AbortError') return
        // Network error — retry with backoff
        const delay = Math.min(BASE_DELAY * 2 ** attempt, 15000)
        await new Promise(r => setTimeout(r, delay))
        continue
      }
    }

    // Exhausted all reconnect attempts
    setError('Lost connection to server after multiple retries')
    setResearchState('error')
    clearActiveTask()
    taskIdRef.current = null
  }, [handleEvent])

  // -----------------------------------------------------------------------
  // Reconnect when tab becomes visible again
  // -----------------------------------------------------------------------
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const taskId = taskIdRef.current
      if (!taskId) return
      // Only reconnect if we think research is still running
      setResearchState(prev => {
        if (prev === 'running') {
          connectToTask(taskId)
        }
        return prev
      })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [connectToTask])

  // -----------------------------------------------------------------------
  // Start a new research
  // -----------------------------------------------------------------------
  const startResearch = useCallback(async (query: string) => {
    abortRef.current?.abort()
    researcherCountRef.current = { done: 0, total: 0 }
    lastEventIdRef.current = 0

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
      const taskId = await startTask(query)
      saveActiveTask(taskId, query)
      await connectToTask(taskId)
    } catch (err) {
      setError((err as Error).message ?? 'Failed to start research')
      setResearchState('error')
      clearActiveTask()
      taskIdRef.current = null
      setMessages(prev => prev.map(m =>
        m.status === 'running' ? { ...m, status: 'error' as const, finishedAt: Date.now() } : m
      ))
    }
  }, [connectToTask])

  // -----------------------------------------------------------------------
  // Stop running research
  // -----------------------------------------------------------------------
  const stopResearch = useCallback(async () => {
    const taskId = taskIdRef.current
    if (taskId) {
      await cancelTask(taskId).catch(() => {})
    }
    abortRef.current?.abort()
    clearActiveTask()
    taskIdRef.current = null

    // Mark any running messages as done
    setMessages(prev => prev.map(m =>
      m.status === 'running' ? { ...m, status: 'done' as const, finishedAt: Date.now() } : m
    ))
    setResearchState('idle')
    setError('Research was stopped')
  }, [])

  // -----------------------------------------------------------------------
  // Reconnect to active task on mount (survives page refresh)
  // -----------------------------------------------------------------------
  useEffect(() => {
    const saved = loadActiveTask()
    if (!saved) return

    let cancelled = false

    ;(async () => {
      const status = await getTaskStatus(saved.taskId).catch(() => null)
      if (cancelled || !status) {
        // Server restarted or task gone — clean up
        clearActiveTask()
        return
      }

      // Set up initial UI state for reconnection
      researcherCountRef.current = { done: 0, total: 0 }
      lastEventIdRef.current = 0

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        status: 'done',
        data: { query: saved.query },
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

      // Reconnect — events replay from the beginning
      await connectToTask(saved.taskId)
    })()

    return () => { cancelled = true }
  }, [connectToTask])

  // -----------------------------------------------------------------------
  // Session management
  // -----------------------------------------------------------------------
  const loadSession = useCallback((session: ResearchSession) => {
    abortRef.current?.abort()
    setActiveSession(session)
    setResearchState('done')
    setError(null)

    if (session.messages && session.messages.length > 0) {
      setMessages(session.messages)
    } else {
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

  const deleteSession = useCallback((id: string) => {
    removeSession(id)
    setActiveSession(prev => {
      if (prev?.id === id) {
        setResearchState('idle')
        setMessages([])
        setError(null)
        return null
      }
      return prev
    })
  }, [removeSession])

  return {
    researchState,
    messages,
    report,
    sources,
    sourcesCount,
    history,
    historyLoading,
    activeSession,
    error,
    startResearch,
    stopResearch,
    loadSession,
    newResearch,
    deleteSession,
  }
}
