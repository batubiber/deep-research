# Frontend Design Spec — Deep Research Dashboard

**Date:** 2026-03-28
**Status:** Approved

---

## Context

The deep-research backend exposes a 6-agent LangGraph pipeline via two FastAPI endpoints:
- `POST /api/v1/research` — synchronous, returns `{report, sources_count}`
- `POST /api/v1/research/stream` — SSE streaming, emits `{node, output}` per agent completion

There is currently no frontend. Research can only be triggered via curl or API clients. The goal is a production-grade React dashboard that lets users submit queries, watch the pipeline run in real time, and read the final report — all in a modern dark glass UI.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | React 18 + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v3 |
| Markdown rendering | `react-markdown` + `remark-gfm` |
| Icons | `lucide-react` |
| SSE transport | `fetch` + `ReadableStream` (not native EventSource — backend uses POST) |
| History persistence | `localStorage` (no backend storage needed) |

Frontend lives at `frontend/` in the project root. In production it's built (`npm run build`) and FastAPI serves `frontend/dist/` as static files. In development, Vite runs on port 5173 with proxy to the FastAPI backend on 8000.

---

## Layout

3-column dashboard, fixed sidebar + fixed pipeline panel + fluid report area:

```
┌──────────────────────────────────────────────────────────┐
│ ⬡ DeepResearch                              [model badge] │
├────────────┬─────────────────────────────────────────────┤
│  History   │  🔍 [What do you want to research?] [Search]│
│  (w-56)    ├─────────────────┬───────────────────────────┤
│            │  Pipeline (w-72)│  Report (flex-1)          │
│  ○ Query 1 │  ─────────────  │  ────────────────────     │
│  ○ Query 2 │  ✓ Planner     │  # Title                  │
│  ● Query 3 │  ✓ Researcher  │  ## Executive Summary     │
│            │  ⟳ Analyst     │  ...markdown rendered...  │
│  [+ New]   │  ○ Reviewer     │                           │
│            │  ○ Gap Res.    │                           │
│            │  ○ Writer       │  ── Sources (13) ──       │
│            │                 │  • arxiv.org  [● high]    │
└────────────┴─────────────────┴───────────────────────────┘
```

Theme: GitHub dark base (`#0d1117`), glassmorphism panels (`bg-white/5 backdrop-blur border-white/10`), blue accent (`#58a6ff` / `#1f6feb`).

---

## Component Tree

```
src/
├── App.tsx                  — layout shell, holds global state
├── components/
│   ├── Sidebar.tsx          — history list + "New Research" button
│   ├── SearchBar.tsx        — query input + submit, disabled while running
│   ├── PipelinePanel.tsx    — ordered list of AgentCards
│   │   └── AgentCard.tsx   — per-agent: status icon, name, metadata, elapsed
│   ├── ReportPanel.tsx      — markdown renderer + sources list below
│   │   └── SourceItem.tsx  — title, URL, E-E-A-T badge, truncated snippet
│   └── EEATBadge.tsx        — colored pill: ● high (green) / medium (yellow) / low (gray)
├── hooks/
│   └── useResearch.ts       — all research logic: SSE, state, history
├── types.ts                 — AgentStatus, ResearchSession, Source, EEATScore
└── lib/
    └── api.ts               — typed fetch wrappers for /api/v1/*
```

---

## Types

```typescript
type EEATScore = 'high' | 'medium' | 'low'

type AgentName = 'planner' | 'research_assistant' | 'analyst' | 'reviewer' | 'gap_researcher' | 'writer'

type AgentStatus = {
  name: AgentName
  status: 'pending' | 'running' | 'done' | 'error'
  startedAt?: number      // ms timestamp
  finishedAt?: number
  metadata?: Record<string, string | number>  // complexity, sub-question count, etc.
}

type Source = {
  title: string
  url: string
  content: string
  eet_score: EEATScore
}

type ResearchSession = {
  id: string              // crypto.randomUUID()
  query: string
  timestamp: number
  report?: string
  sources?: Source[]      // parsed from report's ## Sources section
  sourcesCount?: number
}
```

---

## Data Flow

### Streaming (live progress)

1. User submits query → `useResearch` calls `startResearch(query)`
2. `fetch POST /api/v1/research/stream` with `{query}` body
3. Read `response.body` as `ReadableStream`, decode line by line
4. Each line matching `data: {...}` → parse JSON `{node, output}`
5. Map `node` to `AgentName` → set that agent's status to `done`, record `finishedAt`
6. Next agent in pipeline order → set to `running`
7. On stream close → all agents done, trigger sync fetch for clean report

### Sync fetch (final report)

After stream ends (or in parallel from the start):
`fetch POST /api/v1/research` → `{report, sources_count}`

The streaming output is truncated to 500 chars/event and not suitable for displaying the full report. The sync endpoint returns the complete, clean result.

**Strategy:** Open both in parallel. Stream drives the live pipeline UI. Sync result populates the ReportPanel when ready.

### Sources (parsed from report)

The sync endpoint returns `sources_count` but not structured source objects. The writer agent always appends a `## Sources` section to the report in this format:
```
## Sources
1. Title — https://example.com
2. Paper Title — https://arxiv.org/abs/...
```

Parse this section on the frontend after receiving the report:
- Extract numbered entries with regex
- Compute E-E-A-T score from URL domain using same heuristic as backend:
  - `high`: `.gov`, `.edu`, `arxiv.org`, `nature.com`, `science.org`, `ieee.org`, `nih.gov`
  - `medium`: `wikipedia.org`, `reuters.com`, `bbc.com`, `github.com`, etc.
  - `low`: everything else
- Render as `SourceItem` cards below the report markdown

### Pipeline order & agent card metadata

| Agent | Display name | Done metadata shown | Running label |
|---|---|---|---|
| `planner` | Planner | complexity badge + "N sub-questions" | "Decomposing query..." |
| `research_assistant` | Researcher ×N | tool per researcher (arxiv/web/wiki) | progress bar (N done / total) |
| `analyst` | Analyst | "N sources synthesized" | "Synthesizing N sources..." |
| `reviewer` | Reviewer | quality score badge (1–10, color-coded) | "Reviewing analysis..." |
| `gap_researcher` | Gap Researcher | "N gaps filled" | "Filling knowledge gaps..." |
| `writer` | Writer | — | "Writing final report..." |

The `research_assistant` node fires multiple SSE events (one per sub-question). Track count: first event → status `running`, subsequent events → increment counter, last expected event → status `done`. Expected count comes from planner metadata (sub-question count).

---

## FastAPI Integration

### CORS (development)

Add to `app/main.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Static file serving (production)

```python
from fastapi.staticfiles import StaticFiles

# Mount AFTER all API routes
app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
```

### Vite proxy (development)

`frontend/vite.config.ts`:
```typescript
server: {
  proxy: {
    '/api': 'http://localhost:8000'
  }
}
```

---

## History

- Stored in `localStorage` under key `deep-research-history`
- Each entry is a `ResearchSession` (id, query, timestamp, report, sources)
- Max 20 entries; oldest pruned when limit exceeded
- Clicking a history item populates the report panel with cached data (no re-fetch)
- "New Research" button clears active session, resets pipeline panel

---

## Error States

| Error | Handling |
|---|---|
| Network error on stream | Show error toast, reset pipeline to idle |
| Backend 500 on sync | Show error in ReportPanel ("Research failed — try again") |
| Stream partial failure | Keep already-done agent cards visible, show error on failed node |
| Empty query submit | Disable Search button when input is empty |

---

## Verification

After implementation, verify end-to-end:

1. `cd frontend && npm run dev` — Vite starts on 5173
2. `uvicorn app.main:app --reload` — FastAPI on 8000
3. Submit a research query — all 6 agent cards progress correctly
4. Researcher card shows parallel progress bar
5. ReportPanel renders markdown (headings, tables, bold, lists)
6. Sources appear below report with correct E-E-A-T badge colors
7. Session saved to localStorage, appears in sidebar history
8. Clicking history item restores report without re-running
9. `npm run build` → `frontend/dist/` created
10. FastAPI serves `frontend/dist` — app works at `http://localhost:8000`
