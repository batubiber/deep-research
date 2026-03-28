# Deep Research

A 6-agent deep research pipeline powered by **FastAPI**, **LangGraph**, and **vLLM**. Submit a question, watch six specialized AI agents collaborate in real time, and receive a comprehensive research report with scored sources.

<!-- ![Dashboard Screenshot](docs/screenshot.png) -->

## Architecture

```
                          ┌─────────────┐
                          │   Planner   │
                          │ Decomposes  │
                          │   query     │
                          └──────┬──────┘
                                 │ fan-out (parallel)
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
              ┌──────────┐┌──────────┐┌──────────┐
              │Researcher││Researcher││Researcher│
              │ Web/ArXiv││ Wikipedia ││ Web/ArXiv│
              └────┬─────┘└────┬─────┘└────┬─────┘
                   └────────────┼───────────┘
                                │ fan-in
                          ┌─────▼─────┐
                          │  Analyst  │
                          │ Synthesize│
                          └─────┬─────┘
                          ┌─────▼─────┐
                          │ Reviewer  │
                          │ Score 1-10│
                          └─────┬─────┘
                          ┌─────▼─────────┐
                          │Gap Researcher │
                          │ Fill gaps     │
                          └─────┬─────────┘
                          ┌─────▼─────┐
                          │  Writer   │
                          │ Final     │
                          │ report    │
                          └───────────┘
```

| Agent | Role |
|---|---|
| **Planner** | Assesses complexity, decomposes query into 2–5 sub-questions |
| **Researcher** | Searches sources in parallel (web, ArXiv, Wikipedia) per sub-question |
| **Analyst** | Cross-references all sources, detects conflicts, synthesizes findings |
| **Reviewer** | Scores research quality (1–10), identifies up to 3 knowledge gaps |
| **Gap Researcher** | Runs targeted searches to fill identified gaps |
| **Writer** | Produces a structured markdown report with citations and confidence ratings |

## Tech Stack

| Layer | Technology |
|---|---|
| Backend framework | FastAPI + Uvicorn |
| Agent orchestration | LangGraph (parallel fan-out/fan-in) |
| LLM serving | vLLM (OpenAI-compatible API) |
| Web search | DuckDuckGo (API-less) |
| Academic search | ArXiv API |
| Knowledge base | Wikipedia API |
| Video transcripts | youtube-transcript-api |
| Frontend | React 19 + TypeScript + Vite + Tailwind CSS |
| Markdown rendering | react-markdown + remark-gfm |
| Package manager | uv |

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager
- Node.js 18+ (for frontend)
- A vLLM-compatible endpoint (or any OpenAI-compatible API)

### Setup

```bash
git clone https://github.com/your-username/deep-research.git
cd deep-research

# Configure environment
cp .env.example .env
# Edit .env — set VLLM_BASE_URL to your model endpoint

# Install Python dependencies
uv sync

# Start the backend
uvicorn app.main:app --reload --port 8000
```

### Frontend (development)

```bash
cd frontend
npm install
npm run dev        # Vite dev server on http://localhost:5173
```

The Vite dev server proxies `/api` requests to the FastAPI backend on port 8000.

### Frontend (production)

```bash
cd frontend
npm run build      # Outputs to frontend/dist/
```

FastAPI automatically serves `frontend/dist/` as static files — visit `http://localhost:8000`.

## API Reference

Base URL: `http://localhost:8000`

### `GET /health`

Health check.

```json
{ "status": "ok", "model": "qwen3-5" }
```

### `POST /api/v1/research`

Run the full pipeline synchronously.

**Request:**
```json
{ "query": "What are the latest advances in quantum error correction?" }
```

**Response:**
```json
{
  "report": "# Quantum Error Correction: Recent Advances\n\n...",
  "sources_count": 13
}
```

### `POST /api/v1/research/stream`

Stream pipeline progress via Server-Sent Events.

**Request:** Same as above.

**Response:** SSE stream with one event per agent completion:

```
data: {"node": "planner", "complexity": "complex", "sub_questions": 4}
data: {"node": "research_assistant", "output": "..."}
data: {"node": "analyst", "output": "..."}
data: {"node": "reviewer", "score": 8}
data: {"node": "gap_researcher", "output": "..."}
data: {"node": "writer", "output": "..."}
data: {"node": "__done__", "report": "# Full Report...", "sources_count": 13}
```

## Search Tools & E-E-A-T Scoring

Each source is scored for **E-E-A-T** (Experience, Expertise, Authoritativeness, Trustworthiness):

| Score | Domains |
|---|---|
| **High** | `.gov`, `.edu`, `arxiv.org`, `nature.com`, `science.org`, `ieee.org`, `nih.gov` |
| **Medium** | `wikipedia.org`, `reuters.com`, `bbc.com`, `github.com`, `stackoverflow.com` |
| **Low** | Everything else |

Available tools:

| Tool | Source | Default results |
|---|---|---|
| `web_search` | DuckDuckGo | 3 |
| `arxiv_search` | ArXiv | 5 |
| `wikipedia_search` | Wikipedia | 2 |
| `youtube_transcript` | YouTube | 1 video |

## Configuration

All settings are managed via environment variables (loaded from `.env`):

| Variable | Default | Description |
|---|---|---|
| **vLLM** | | |
| `VLLM_BASE_URL` | `https://...ngrok.../v1` | OpenAI-compatible API endpoint |
| `VLLM_API_KEY` | `a` | API key (placeholder if auth disabled) |
| `VLLM_MODEL_NAME` | `qwen3-5` | Model ID served by vLLM |
| **Thinking budgets** | | Tokens allocated for chain-of-thought |
| `THINKING_BUDGET_PLANNER` | `1024` | |
| `THINKING_BUDGET_RESEARCHER` | `4096` | |
| `THINKING_BUDGET_ANALYST` | `2048` | |
| `THINKING_BUDGET_REVIEWER` | `1024` | |
| `THINKING_BUDGET_GAP_RESEARCHER` | `4096` | |
| `THINKING_BUDGET_WRITER` | `8192` | |
| **Temperatures** | | Lower = deterministic, higher = creative |
| `TEMPERATURE_PLANNER` | `0.1` | |
| `TEMPERATURE_RESEARCHER` | `0.1` | |
| `TEMPERATURE_ANALYST` | `0.2` | |
| `TEMPERATURE_REVIEWER` | `0.1` | |
| `TEMPERATURE_GAP_RESEARCHER` | `0.1` | |
| `TEMPERATURE_WRITER` | `0.4` | |
| **Parallelism** | | |
| `MAX_PARALLEL_RESEARCHERS` | `4` | Max concurrent researcher agents |
| **API** | | |
| `API_HOST` | `0.0.0.0` | Bind address |
| `API_PORT` | `8000` | Bind port |
| `API_KEY` | _(empty)_ | Optional API key |

## Docker

```bash
cp .env.example .env
# Edit .env with your vLLM endpoint

docker compose up --build
```

The app will be available at `http://localhost:8000` with health checks every 30s.

## Testing

```bash
# Backend tests
pytest tests/ -v

# Frontend tests
cd frontend && npm test

# Frontend tests (watch mode)
cd frontend && npm run test:watch
```

## Project Structure

```
deep-research/
├── app/
│   ├── main.py                  # FastAPI app entry point
│   ├── config.py                # Pydantic settings
│   ├── api/
│   │   ├── routes.py            # /research endpoints (sync + SSE)
│   │   └── schemas.py           # Request/Response models
│   ├── agents/
│   │   ├── graph.py             # LangGraph StateGraph (parallel routing)
│   │   ├── state.py             # ResearchState TypedDict
│   │   ├── prompts.py           # System prompts for all agents
│   │   ├── planner.py           # Query decomposition
│   │   ├── researcher.py        # Parallel source gathering
│   │   ├── analyst.py           # Cross-source synthesis
│   │   ├── reviewer.py          # Quality scoring + gap detection
│   │   ├── gap_researcher.py    # Targeted gap filling
│   │   └── writer.py            # Final report generation
│   ├── tools/
│   │   ├── web_search.py        # DuckDuckGo search
│   │   ├── arxiv_search.py      # ArXiv paper search
│   │   ├── wikipedia_search.py  # Wikipedia API
│   │   └── youtube_transcript.py# YouTube transcript extraction
│   └── llm/
│       └── client.py            # vLLM OpenAI-compatible client
├── frontend/
│   ├── src/
│   │   ├── App.tsx              # Dashboard layout
│   │   ├── components/          # UI components
│   │   ├── hooks/useResearch.ts # SSE state management
│   │   ├── lib/api.ts           # Streaming fetch client
│   │   └── types.ts             # Shared TypeScript types
│   └── vite.config.ts
├── tests/
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml
└── .env.example
```

## License

MIT
