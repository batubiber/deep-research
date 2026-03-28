# Deep Research — CLAUDE.md

Bu dosya Claude Code için proje rehberidir. Projeyi build etmeden önce tamamını oku.

---

## Proje Özeti

Langflow üzerinde çalışan 6 ajanli bir Deep Research pipeline'ını production-ready bir Python uygulamasına dönüştürüyoruz.

**Mevcut durum:** Langflow flow JSON'u (`Deep_Research_v3.json`) çalışıyor ama:
- Sıralı (sequential) çalışıyor → yavaş
- Doğrudan Langflow UI'a bağımlı
- API olarak kullanılamıyor
- Sub-question'lar paralel işlenemiyor

**Hedef:** FastAPI + LangGraph tabanlı, Langflow'dan bağımsız, paralel araştırma yapabilen bir servis.

---

## Stack

```
Python 3.11
FastAPI          — REST API & streaming endpoint
LangGraph        — agent orchestration (paralel sub-agent desteği için)
vLLM             — model serving (OpenAI-compatible API, ngrok üzerinden erişim)
DuckDuckGo       — web arama (API-less)
arxiv            — akademik paper arama
wikipedia        — background context
youtube-transcript-api — video transcript
Pydantic v2      — schema validation
httpx            — async HTTP
Docker           — containerization
```

---

## Proje Dosya Yapısı

```
deep-research/
├── CLAUDE.md                    ← bu dosya
├── pyproject.toml
├── .env.example
├── .env                         ← git'e commit etme
├── Dockerfile
├── docker-compose.yml
│
├── app/
│   ├── __init__.py
│   ├── main.py                  ← FastAPI app, lifespan, router mount
│   ├── config.py                ← Settings (pydantic BaseSettings)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes.py            ← /research endpoint (sync + streaming)
│   │   └── schemas.py           ← Request/Response Pydantic modeller
│   │
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── graph.py             ← LangGraph StateGraph tanımı
│   │   ├── state.py             ← ResearchState TypedDict
│   │   ├── planner.py           ← Planner agent node
│   │   ├── researcher.py        ← Research Assistant node (paralel)
│   │   ├── analyst.py           ← Analyst node
│   │   ├── reviewer.py          ← Reviewer node
│   │   ├── gap_researcher.py    ← Gap Researcher node
│   │   └── writer.py            ← Writer node
│   │
│   ├── tools/
│   │   ├── __init__.py
│   │   ├── web_search.py        ← DuckDuckGo search
│   │   ├── arxiv_search.py      ← ArXiv paper search
│   │   ├── wikipedia_search.py  ← Wikipedia API
│   │   └── youtube_transcript.py← YouTube transcript
│   │
│   └── llm/
│       ├── __init__.py
│       └── client.py            ← vLLM OpenAI-compatible client
│
└── tests/
    ├── test_tools.py
    ├── test_agents.py
    └── test_api.py
```

---

## vLLM Servis Bilgileri

| Parametre | Değer |
|---|---|
| **Endpoint** | `https://kent-unurbane-many.ngrok-free.dev` |
| **OpenAI-compat base URL** | `https://kent-unurbane-many.ngrok-free.dev/v1` |
| **Model ID** | `qwen3-5` |
| **API Key** | `a` (vLLM'de auth kapalı, placeholder) |

> **Not:** ngrok URL'i değişebilir. Değişirse sadece `.env` dosyasındaki
> `VLLM_BASE_URL` güncellenir, kod değişmez.

Bağlantıyı test etmek için:
```bash
curl https://kent-unurbane-many.ngrok-free.dev/v1/models \
  -H "Authorization: Bearer a"
```
Beklenen yanıt: `qwen3-5` model ID'sini içeren JSON listesi.

---

# Ortam Değişkenleri (.env)

```bash
# vLLM
VLLM_BASE_URL=https://kent-unurbane-many.ngrok-free.dev/v1
VLLM_API_KEY=a
VLLM_MODEL_NAME=qwen3-5

# Thinking budgets (token cinsinden)
THINKING_BUDGET_PLANNER=1024
THINKING_BUDGET_RESEARCHER=4096
THINKING_BUDGET_ANALYST=2048
THINKING_BUDGET_REVIEWER=1024
THINKING_BUDGET_GAP_RESEARCHER=4096
THINKING_BUDGET_WRITER=8192

# Temperature
TEMPERATURE_PLANNER=0.1
TEMPERATURE_RESEARCHER=0.1
TEMPERATURE_ANALYST=0.2
TEMPERATURE_REVIEWER=0.1
TEMPERATURE_GAP_RESEARCHER=0.1
TEMPERATURE_WRITER=0.4

# Parallelism
MAX_PARALLEL_RESEARCHERS=4      # sub-question başına max paralel araştırmacı

# API
API_HOST=0.0.0.0
API_PORT=8000
API_KEY=                        # opsiyonel, boş bırakılabilir
```

---

## LangGraph State Tanımı

`app/agents/state.py` dosyası:

```python
from typing import TypedDict, Annotated
import operator

class SubQuestion(TypedDict):
    id: int
    question: str
    suggested_tool: str          # "web_search" | "arxiv" | "wikipedia"
    sources: list[dict]          # Research Assistant doldurur
    analysis: dict               # Analyst doldurur

class ResearchState(TypedDict):
    # Input
    query: str
    complexity: str              # "simple" | "moderate" | "complex"

    # Planner output
    main_question: str
    sub_questions: list[SubQuestion]

    # Pipeline outputs
    raw_sources: Annotated[list, operator.add]   # paralel researcher'lar biriktirsin
    analysis: str
    review: dict
    gap_findings: str

    # Final
    final_report: str
    error: str | None
```

---

## LangGraph Graph Tanımı

`app/agents/graph.py` — kritik nokta: Research Assistant paralel çalışmalı.

```python
from langgraph.graph import StateGraph, END
from langgraph.constants import Send

def route_to_researchers(state: ResearchState) -> list[Send]:
    """
    Planner'ın ürettiği her sub-question için
    ayrı bir researcher node başlat (paralel).
    """
    return [
        Send("research_assistant", {
            "query": state["query"],
            "sub_question": sq,
        })
        for sq in state["sub_questions"]
    ]

builder = StateGraph(ResearchState)

builder.add_node("planner", planner_node)
builder.add_node("research_assistant", researcher_node)   # paralel çalışacak
builder.add_node("analyst", analyst_node)
builder.add_node("reviewer", reviewer_node)
builder.add_node("gap_researcher", gap_researcher_node)
builder.add_node("writer", writer_node)

builder.set_entry_point("planner")
builder.add_conditional_edges("planner", route_to_researchers)  # fan-out
builder.add_edge("research_assistant", "analyst")               # fan-in (otomatik)
builder.add_edge("analyst", "reviewer")
builder.add_edge("reviewer", "gap_researcher")
builder.add_edge("gap_researcher", "writer")
builder.add_edge("writer", END)

graph = builder.compile()
```

---

## vLLM Client

`app/llm/client.py` — thinking budget'ı her agent için ayrı set et:

```python
from openai import AsyncOpenAI
from app.config import settings

def get_llm_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url=settings.vllm_base_url,
        api_key=settings.vllm_api_key,
    )

async def chat(
    messages: list[dict],
    thinking_budget: int,
    temperature: float,
    max_tokens: int = 8192,
) -> str:
    client = get_llm_client()
    response = await client.chat.completions.create(
        model=settings.vllm_model_name,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        extra_body={
            "chat_template_kwargs": {
                "enable_thinking": True,
                "thinking_budget": thinking_budget,
            }
        }
    )
    return response.choices[0].message.content
```

---

## Tool Yapısı

Her tool aynı interface'i implement etmeli:

```python
# app/tools/web_search.py örneği
from dataclasses import dataclass

@dataclass
class SearchResult:
    title: str
    url: str
    content: str
    eet_score: str    # "high" | "medium" | "low"

async def web_search(query: str, max_results: int = 3) -> list[SearchResult]:
    ...

async def arxiv_search(query: str, max_results: int = 5) -> list[SearchResult]:
    ...

async def wikipedia_search(query: str, max_results: int = 2) -> list[SearchResult]:
    ...

async def youtube_transcript(video_url: str) -> SearchResult:
    ...
```

E-E-A-T skoru için basit domain heuristiği uygula:
- `.gov`, `.edu`, `arxiv.org`, `nature.com`, `science.org` → `high`
- Bilinen haber kaynakları, Wikipedia → `medium`
- Geri kalanlar → `low`

---

## FastAPI Endpoint

`app/api/routes.py`:

```python
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.api.schemas import ResearchRequest, ResearchResponse
from app.agents.graph import graph
import json

router = APIRouter()

@router.post("/research")
async def run_research(req: ResearchRequest) -> ResearchResponse:
    """Senkron endpoint — tüm pipeline bitmesini bekler."""
    result = await graph.ainvoke({"query": req.query})
    return ResearchResponse(
        report=result["final_report"],
        sources_count=len(result["raw_sources"]),
    )

@router.post("/research/stream")
async def run_research_stream(req: ResearchRequest):
    """Streaming endpoint — her agent tamamlandığında chunk gönderir."""
    async def event_generator():
        async for event in graph.astream_events(
            {"query": req.query}, version="v2"
        ):
            if event["event"] == "on_chain_end":
                node = event.get("name", "")
                data = event.get("data", {})
                yield f"data: {json.dumps({'node': node, 'output': str(data)[:500]})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

---

## Agent Prompt'ları

Mevcut system prompt'ları `Deep_Research_v3.json` içinde hazır.
Her agent node'unda JSON'dan al veya direkt kod içinde tanımla.

Agent prompt sabitleri `app/agents/prompts.py` dosyasına taşı:

```python
PLANNER_PROMPT = """..."""    # Deep_Research_v3.json'daki Agent-IM9L1 system_prompt
RESEARCHER_PROMPT = """..."""  # Agent-KiiUP
ANALYST_PROMPT = """..."""     # Agent-ws7MI
REVIEWER_PROMPT = """..."""    # Agent-SMOBv
GAP_RESEARCHER_PROMPT = """...""" # Agent-4w2xt
WRITER_PROMPT = """..."""      # Agent-5z6Gl
```

---

## Build Sırası (Claude Code için)

Bu sırayı takip et, önce foundation'ı kur:

1. `pyproject.toml` + bağımlılıklar
2. `app/config.py` — Settings
3. `app/llm/client.py` — vLLM bağlantısı, test et
4. `app/tools/` — 4 tool, her birini ayrı test et
5. `app/agents/state.py` — TypedDict
6. `app/agents/prompts.py` — prompt sabitleri (v3 JSON'dan al)
7. `app/agents/planner.py` — en basit node, önce bunu bitir
8. `app/agents/researcher.py` — tool entegrasyonu burada
9. `app/agents/analyst.py`
10. `app/agents/reviewer.py`
11. `app/agents/gap_researcher.py`
12. `app/agents/writer.py`
13. `app/agents/graph.py` — hepsini bağla, paralel routing ekle
14. `app/api/schemas.py` + `app/api/routes.py`
15. `app/main.py` — FastAPI app
16. `Dockerfile` + `docker-compose.yml`
17. `tests/` — önce tool testleri

---

## Bağımlılıklar (pyproject.toml)

```toml
[project]
name = "deep-research"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "langgraph>=0.2.0",
    "langchain-openai>=0.2.0",
    "openai>=1.50.0",
    "httpx>=0.27.0",
    "pydantic>=2.8.0",
    "pydantic-settings>=2.4.0",
    "arxiv>=2.1.0",
    "wikipedia>=1.4.0",
    "youtube-transcript-api>=0.6.2",
    "duckduckgo-search>=6.2.0",
    "beautifulsoup4>=4.12.0",
    "python-dotenv>=1.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0.0",
    "pytest-asyncio>=0.23.0",
    "httpx>=0.27.0",
]
```

---

## Dikkat Edilecek Noktalar

**vLLM ngrok URL değişiyor:** `VLLM_BASE_URL` `.env`'de tutulmalı, kod içine yazılmamalı.

**Thinking token'ları response'a yansır:** vLLM `<think>...</think>` bloklarını döndürür. Her agent node'unda response'dan thinking bloğunu strip etmeyi unutma:
```python
import re
def strip_thinking(text: str) -> str:
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()
```

**Paralel researcher'lar context'i biriktirsin:** LangGraph'ın `Annotated[list, operator.add]` state alanı paralel node'lardan gelen sonuçları otomatik merge eder — `raw_sources` alanına dokunma.

**Reviewer max 3 gap döndürmeli:** Kod tarafında da enforce et, 3'ten fazlaysa ilk 3'ü al.

**Streaming'de timeout:** Uzun araştırmalarda (200+ sn) nginx/proxy timeout'u olabilir. `docker-compose.yml`'de timeout ayarlarını yap.

---

## Geliştirme Komutları

```bash
# Bağımlılıkları yükle
uv sync

# Geliştirme sunucusu
uvicorn app.main:app --reload --port 8000

# Test
pytest tests/ -v

# Docker
docker compose up --build

# Langflow JSON'dan prompt'ları çek
python scripts/extract_prompts.py Deep_Research_v3.json
```

---

## Kısa Vadeli Roadmap (scope dışı, sonraki sprint)

- [ ] Redis cache: aynı query tekrar gelirse cached sonuç dön
- [ ] Celery: araştırmayı background task'a taşı
- [ ] PostgreSQL: araştırma geçmişi kaydet
- [ ] LangSmith: trace ve observability
- [ ] Rate limiting: DuckDuckGo block yememeye dikkat
