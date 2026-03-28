// frontend/src/types.ts

export type EEATScore = 'high' | 'medium' | 'low'

export type AgentName =
  | 'planner'
  | 'research_assistant'
  | 'summarizer'
  | 'analyst'
  | 'reviewer'
  | 'gap_researcher'
  | 'gap_integrator'
  | 'writer'
  | 'citation_verifier'

export interface Source {
  title: string
  url: string
  eet_score: EEATScore
}

export interface ChatMessage {
  id: string
  role: 'user' | 'agent'
  agentName?: AgentName
  displayName?: string
  status: 'pending' | 'running' | 'done' | 'error'
  startedAt?: number
  finishedAt?: number
  data: Record<string, any>
}

export interface ResearchSession {
  id: string
  query: string
  timestamp: number
  messages?: ChatMessage[]
  report?: string
  sources?: Source[]
  sourcesCount?: number
}
