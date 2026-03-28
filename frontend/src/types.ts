// frontend/src/types.ts

export type EEATScore = 'high' | 'medium' | 'low'

export type AgentName =
  | 'planner'
  | 'research_assistant'
  | 'analyst'
  | 'reviewer'
  | 'gap_researcher'
  | 'writer'

export interface AgentStatus {
  name: AgentName
  displayName: string
  status: 'pending' | 'running' | 'done' | 'error'
  startedAt?: number   // ms timestamp
  finishedAt?: number
  metadata?: Record<string, string | number>
}

export interface Source {
  title: string
  url: string
  eet_score: EEATScore
}

export interface ResearchSession {
  id: string
  query: string
  timestamp: number
  report?: string
  sources?: Source[]   // parsed from ## Sources section of report
  sourcesCount?: number
}
