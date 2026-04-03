import { useState, useCallback, useEffect } from 'react'
import type { ResearchSession } from '../types'
import { initDB, getAllSessions, putSession, deleteSessionById } from '../lib/db'

const MAX_SESSIONS = 100

export function useSessionStore() {
  const [sessions, setSessions] = useState<ResearchSession[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load sessions from IndexedDB on mount (runs migration first time)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await initDB()
      const all = await getAllSessions()
      if (!cancelled) {
        setSessions(all)
        setIsLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const addSession = useCallback(async (session: ResearchSession) => {
    await putSession(session)
    setSessions(prev => {
      const updated = [session, ...prev.filter(s => s.id !== session.id)]
      // Trim oldest sessions beyond the limit
      if (updated.length > MAX_SESSIONS) {
        const toRemove = updated.slice(MAX_SESSIONS)
        for (const s of toRemove) deleteSessionById(s.id)
      }
      return updated.slice(0, MAX_SESSIONS)
    })
  }, [])

  const removeSession = useCallback(async (id: string) => {
    await deleteSessionById(id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }, [])

  return { sessions, isLoading, addSession, removeSession }
}
