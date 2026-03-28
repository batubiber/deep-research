// frontend/src/lib/api.ts

const BASE = '/api/v1'

/** Shape of each SSE event emitted by the streaming endpoint */
export interface SSEEvent {
  node: string
  output?: string
  // planner extras
  sub_questions?: number
  complexity?: string
  // reviewer extras
  score?: number
  // __done__ event
  report?: string
  sources_count?: number
}

/**
 * POST /api/v1/research/stream
 * Reads the SSE response body line by line and calls onEvent for each parsed event.
 * Resolves when the stream closes. Rejects on network error.
 * Pass an AbortSignal to cancel.
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
