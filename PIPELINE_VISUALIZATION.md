# Deep Research: Multi-Agent Pipeline Visualization

## Overview

A production-grade deep research system powered by 10 specialized AI agents orchestrated through LangGraph. The pipeline transforms a single user query into a comprehensive, citation-verified research report through parallel execution, iterative refinement, and intelligent gap analysis.

---

## Pipeline Architecture Diagram Description

### Visual Layout: Top-to-Bottom Flow with Parallel Fan-Out

```
USER QUERY
    |
    v
[1. PLANNER] -----> Generates N sub-questions
    |
    |--- Fan-Out (Parallel) --->
    |                           |
    v                           v
[2a. RESEARCHER]    [2b. RESEARCHER]    [2c. RESEARCHER]   ... [2n. RESEARCHER]
  (Sub-Q #1)          (Sub-Q #2)          (Sub-Q #3)            (Sub-Q #N)
  |  Up to 3          |  Up to 3          |  Up to 3            |
  |  search           |  search           |  search             |
  |  rounds           |  rounds           |  rounds             |
  |  each             |  each             |  each               |
  |                   |                   |                     |
  v                   v                   v                     v
  [TOOLS]             [TOOLS]             [TOOLS]               [TOOLS]
  - Web Search        - ArXiv             - Wikipedia           - Any tool
  - Jina Reader       - Jina Reader       - Direct fetch        - Fallback
    |                   |                   |                     |
    +-------------------+-------------------+---------------------+
                        |
                        v  (Fan-In: all sources merge)
                [3. DEDUPLICATOR]
                        |
                        v
                [4. SUMMARIZER]
                        |
                        v
                [5. ANALYST]
                        |
                        v
                [6. REVIEWER] -----> Identifies up to 3 knowledge gaps
                        |
                        v
                [7. GAP RESEARCHER] -----> Targeted searches to fill gaps
                        |
                        v
                [8. GAP INTEGRATOR] -----> Merges new findings into analysis
                        |
                        v
                [9. WRITER] -----> Produces final research report
                        |
                        v
                [10. CITATION VERIFIER] -----> Validates all citations
                        |
                        v
                  FINAL REPORT
```

---

## Agent Descriptions (10 Agents)

### Agent 1: PLANNER
- **Role:** Strategic Decomposer
- **Icon concept:** Brain with branching arrows / Blueprint
- **Color:** Blue (#3B82F6)
- **Input:** Raw user query
- **Output:** Main question + list of sub-questions with suggested tools
- **Behavior:** Analyzes query complexity (simple/moderate/complex), breaks it into focused sub-questions, assigns the best search tool for each
- **Critical:** If planner fails, entire pipeline halts (fatal node)

### Agent 2: RESEARCH ASSISTANT (Parallel x N)
- **Role:** Information Gatherer
- **Icon concept:** Magnifying glass with gears / Multiple parallel search beams
- **Color:** Green (#10B981)
- **Input:** One sub-question + suggested tool
- **Output:** Collected sources with E-E-A-T quality scores
- **Behavior:** Runs up to 3 iterative search rounds per sub-question. After each round, reflects on whether sources are sufficient. If primary tool fails, falls back to web search. Simplifies query if no results found.
- **Parallel:** Multiple instances run simultaneously, one per sub-question
- **Tools connected:** Web Search, ArXiv, Wikipedia, YouTube, Twitter/X, Reddit, Jina Reader

### Agent 3: DEDUPLICATOR
- **Role:** Source Cleaner
- **Icon concept:** Filter funnel / Merge arrows
- **Color:** Slate (#64748B)
- **Input:** All raw sources from all parallel researchers (merged via operator.add)
- **Output:** Deduplicated source list (unique URLs)
- **Behavior:** Removes duplicate sources that were found by multiple researchers

### Agent 4: SUMMARIZER
- **Role:** Content Condenser
- **Icon concept:** Compress/squeeze arrows / Document shrinking
- **Color:** Amber (#F59E0B)
- **Input:** Deduplicated sources
- **Output:** Condensed summary of all source material
- **Behavior:** Creates a coherent summary from all collected sources for the analyst

### Agent 5: ANALYST
- **Role:** Deep Analyzer
- **Icon concept:** Chart/graph with magnifying glass / Microscope
- **Color:** Purple (#8B5CF6)
- **Input:** Summarized sources + original query
- **Output:** Structured analysis with findings, patterns, and insights
- **Behavior:** Synthesizes information across all sources, identifies key themes, contradictions, and evidence patterns

### Agent 6: REVIEWER
- **Role:** Quality Auditor & Gap Detector
- **Icon concept:** Clipboard with checkmark + warning triangle / Inspector badge
- **Color:** Orange (#F97316)
- **Input:** Analysis
- **Output:** Quality score + up to 3 identified knowledge gaps
- **Behavior:** Evaluates analysis completeness and quality. Identifies missing perspectives, under-explored areas, or weak evidence. Limited to max 3 gaps to keep pipeline focused.

### Agent 7: GAP RESEARCHER
- **Role:** Targeted Gap Filler
- **Icon concept:** Puzzle piece being placed / Target with arrows
- **Color:** Red (#EF4444)
- **Input:** Identified gaps from reviewer
- **Output:** New findings specifically addressing each gap
- **Behavior:** Auto-selects search tool based on gap type (academic keywords -> ArXiv, opinions -> Twitter, community -> Reddit, default -> Web). Searches independently for each gap.
- **Tools connected:** Same tool set as Research Assistant

### Agent 8: GAP INTEGRATOR
- **Role:** Knowledge Merger
- **Icon concept:** Two streams merging into one / Jigsaw completing
- **Color:** Teal (#14B8A6)
- **Input:** Original analysis + gap findings
- **Output:** Enhanced analysis with gaps filled
- **Behavior:** Semantically integrates new gap findings into the existing analysis. If no gaps were found, passes analysis through unchanged.

### Agent 9: WRITER
- **Role:** Report Author
- **Icon concept:** Pen writing on document / Typewriter
- **Color:** Indigo (#6366F1)
- **Input:** Enhanced analysis + all sources
- **Output:** Final research report in structured markdown
- **Behavior:** Produces a comprehensive, well-structured report with proper citations, sections, and evidence-backed conclusions. Constrained to only cite verified sources.

### Agent 10: CITATION VERIFIER
- **Role:** Citation Validator
- **Icon concept:** Shield with checkmark / Chain link inspector
- **Color:** Emerald (#059669)
- **Input:** Final report + deduplicated source list
- **Output:** Verified report with all citations validated
- **Behavior:** Extracts every URL from the report, cross-references against the actual source list. Unverified citations are removed or replaced. Ensures report integrity.

---

## Search Tools (7 Tools)

### Tool Layer (Connected to Researchers & Gap Researcher)

| Tool | Icon Concept | Color | Description |
|------|-------------|-------|-------------|
| **Web Search** | Globe with magnifying glass | Blue | Tavily API search + Jina Reader full page enrichment |
| **ArXiv Search** | Academic paper / Graduation cap | Purple | Academic paper search with parallel HTML fetching |
| **Wikipedia** | Book / Encyclopedia | Silver | Direct Wikipedia page content retrieval |
| **YouTube** | Play button / Video transcript | Red | Video transcript extraction via yt_dlp |
| **Twitter/X** | Bird / Social bubble | Cyan | Social media opinion search via Tavily domain filter |
| **Reddit** | Discussion bubbles / Community | Orange | Community discussion search via Reddit JSON API |
| **Jina Reader** | Document scanner / Full page | Gold | Full page content extraction for source enrichment |

---

## E-E-A-T Source Quality Scoring System

Every collected source receives a credibility score based on 5 weighted factors:

| Factor | Weight | What It Measures |
|--------|--------|-----------------|
| Domain Authority | 40% | Institutional TLDs (.gov, .edu), academic domains (arxiv.org, nature.com) |
| Content Depth | 25% | Word count and comprehensiveness |
| Technical Specificity | 12% | Numbers, data points, technical terminology |
| Reference Density | 13% | Citations, DOIs, external links |
| Structural Quality | 10% | Headers, tables, formatting |

**Score Thresholds:**
- **HIGH** (>= 0.50) - Authoritative, institutional sources
- **MEDIUM** (>= 0.25) - Established news, Wikipedia, quality blogs
- **LOW** (< 0.25) - Unverified or low-authority sources

---

## Data Flow Through Pipeline

### State Object (Shared Across All Agents)

```
ResearchState {
  query .................. Original user question
  complexity ............. "simple" | "moderate" | "complex"
  main_question .......... Refined research question
  sub_questions[] ........ Decomposed sub-questions with tool suggestions
  raw_sources[] .......... Accumulated from all parallel researchers
  deduplicated_sources[] . Unique sources after dedup
  summarized_sources ..... Condensed source material
  analysis ............... Initial analytical synthesis
  enhanced_analysis ...... Analysis after gap integration
  review ................. Quality score + gaps
  gap_findings ........... New information from gap research
  final_report ........... Complete markdown report
  citation_verification .. Verified report output
  error .................. Error tracking (timestamped)
}
```

---

## Key Architectural Features

### 1. Parallel Fan-Out / Fan-In
- Planner creates N sub-questions
- LangGraph's `Send()` mechanism spawns N parallel researcher instances
- All results merge automatically into shared state via `operator.add`
- Visual: Single pipe splitting into multiple parallel streams, then converging back

### 2. Iterative Research (Up to 3 Rounds)
- Each researcher performs up to 3 search rounds
- After each round: LLM reflection evaluates source sufficiency
- If insufficient: generates refined query for next round
- If no improvement possible: exits early
- Visual: Circular arrow loop within each researcher box

### 3. Intelligent Tool Selection
- Planner suggests best tool per sub-question
- Gap Researcher auto-selects based on keywords:
  - Academic terms -> ArXiv
  - Opinion keywords -> Twitter/X
  - Community terms -> Reddit
  - Default -> Web Search
- Fallback chain: primary tool -> web_search -> simplified query retry

### 4. Two-Phase Research
- Phase 1: Broad research via parallel researchers
- Phase 2: Targeted gap-filling research after review
- Visual: Two distinct research waves in the pipeline

### 5. Citation Integrity Loop
- Writer constrained to cite only verified sources
- Citation Verifier cross-references every URL
- Unverified citations removed or replaced
- Visual: Shield/lock icon at the end of pipeline

---

## Frontend Architecture

### Real-Time Streaming UI

```
+------------------+  +------------------------------------------------+
|                  |  |                                                |
|    SIDEBAR       |  |              CHAT AREA                        |
|                  |  |                                                |
|  Session List    |  |  [User Query Bubble]                          |
|  - Session 1     |  |                                               |
|  - Session 2     |  |  [Planner Agent Card]  -- status: done 3.2s   |
|  - Session 3     |  |    > Main question                            |
|  (IndexedDB)     |  |    > Sub-questions (1, 2, 3...)               |
|                  |  |                                                |
|  + New Session   |  |  [Researcher Card #1] -- status: running      |
|                  |  |    > Sources found (E-E-A-T badges)           |
|  Theme Toggle    |  |                                                |
|  Version Label   |  |  [Researcher Card #2] -- status: done 8.1s   |
|                  |  |    > Sources with quality scores              |
|                  |  |                                                |
|                  |  |  [Analyst Card] -- status: running             |
|                  |  |    > Analysis preview...                      |
|                  |  |                                                |
|                  |  |  ... more agent cards as they complete ...     |
|                  |  |                                                |
|                  |  |  [Final Report] -- expandable markdown view   |
|                  |  |    > Export: [MD] [PDF]                        |
|                  |  |                                                |
|                  |  +------------------------------------------------+
|                  |  |  [Chat Input]                    [Send/Stop]   |
+------------------+  +------------------------------------------------+
```

### Streaming Protocol
- Server-Sent Events (SSE) with event replay
- Each agent completion triggers an SSE frame
- `Last-Event-ID` header for reconnection without data loss
- Exponential backoff reconnection (1s -> 2s -> 4s -> max 15s)
- Auto-reconnect on tab visibility change

---

## Technology Stack

### Backend
- **Python 3.11** - Runtime
- **FastAPI** - REST API + SSE streaming
- **LangGraph** - Agent orchestration with parallel execution
- **vLLM** - Model serving (Qwen3-5 via OpenAI-compatible API)
- **Pydantic v2** - Schema validation
- **httpx** - Async HTTP client

### Frontend
- **React 19** - UI framework
- **TypeScript 5.9** - Type safety
- **Vite 8** - Build tool
- **Tailwind CSS 3.4** - Styling
- **Anime.js** - Agent card animations
- **IDB** - IndexedDB for session persistence
- **react-markdown + remark-gfm** - Report rendering

---

## Visual Style Guide for Diagram

### Color Palette
- **Background:** Dark navy (#0F172A) or white
- **Pipeline flow lines:** Gradient from blue to green
- **Agent nodes:** Rounded rectangles with colored left border
- **Tool nodes:** Smaller rounded squares connected below researchers
- **Parallel section:** Dashed outline box containing all researcher instances
- **Data flow arrows:** Animated gradient lines showing direction
- **E-E-A-T badges:** Traffic light colors (green/yellow/red)

### Suggested Visual Metaphors
- Pipeline as a flowing river that splits (fan-out) and merges (fan-in)
- Each agent as a specialized workstation on an assembly line
- Tools as instruments/devices connected to workstations
- Gap research as a feedback loop / second pass
- Citation verifier as a quality gate / checkpoint
- The whole system as a research laboratory with interconnected stations

### Layout Suggestion
- Vertical flow, top to bottom
- Planner at top, Final Report at bottom
- Parallel researchers spread horizontally in the middle
- Tools shown as a shared tool belt below the researcher section
- Gap research loop shown as a side branch that feeds back into the main flow
- State object shown as a data stream running alongside the entire pipeline
