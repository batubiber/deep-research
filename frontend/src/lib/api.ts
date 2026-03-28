// frontend/src/lib/api.ts

import type { EEATScore } from '../types'

const BASE = '/api/v1'

export interface SSEEvent {
  node: string
  timestamp?: number

  // planner
  main_question?: string
  complexity?: string
  sub_questions?: Array<{ id: number; question: string; suggested_tool: string }>

  // research_assistant
  sub_question_id?: number
  sub_question?: string
  tool_used?: string
  sources?: Array<{
    title: string; url: string; content: string;
    eet_score: EEATScore
  }>
  analysis?: string  // also used by analyst

  // reviewer
  score?: number
  gaps?: string[]
  full_review?: string

  // gap_researcher
  gap_findings?: string
  gap_sources?: Array<{
    title: string; url: string; content: string;
    eet_score: EEATScore; gap_query: string
  }>

  // __done__
  report?: string
  sources_count?: number
}

/**
 * POST /api/v1/research/stream
 * Reads the SSE response body line by line and calls onEvent for each parsed event.
 */
export async function streamResearch(
  query: string,
  onEvent: (event: SSEEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(`${BASE}/research/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal,
  })
  if (!res.ok) throw new Error(`Server error ${res.status}`)
  if (!res.body) throw new Error('No response body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        onEvent(JSON.parse(line.slice(6)) as SSEEvent)
      } catch {
        // skip malformed event
      }
    }
  }
}
