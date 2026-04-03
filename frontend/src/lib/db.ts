import { openDB, type IDBPDatabase } from 'idb'
import type { ResearchSession } from '../types'

const DB_NAME = 'deep-research'
const DB_VERSION = 1
const STORE_NAME = 'sessions'
const LS_HISTORY_KEY = 'deep-research-history'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('timestamp', 'timestamp')
        }
      },
    })
  }
  return dbPromise
}

/** One-time migration: move sessions from localStorage into IndexedDB. */
async function migrateFromLocalStorage(): Promise<void> {
  const raw = localStorage.getItem(LS_HISTORY_KEY)
  if (!raw) return

  try {
    const sessions: ResearchSession[] = JSON.parse(raw)
    if (!Array.isArray(sessions) || sessions.length === 0) {
      localStorage.removeItem(LS_HISTORY_KEY)
      return
    }
    const db = await getDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    for (const session of sessions) {
      if (session.id) tx.store.put(session)
    }
    await tx.done
    localStorage.removeItem(LS_HISTORY_KEY)
  } catch {
    // Corrupted localStorage — remove and move on
    localStorage.removeItem(LS_HISTORY_KEY)
  }
}

/** Initialize the database and run migration if needed. */
export async function initDB(): Promise<void> {
  await getDB()
  await migrateFromLocalStorage()
}

/** Return all sessions sorted by timestamp descending (newest first). */
export async function getAllSessions(): Promise<ResearchSession[]> {
  const db = await getDB()
  const all = await db.getAllFromIndex(STORE_NAME, 'timestamp')
  return all.reverse() as ResearchSession[]
}

/** Add or update a session. */
export async function putSession(session: ResearchSession): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, session)
}

/** Delete a session by ID. */
export async function deleteSessionById(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}
