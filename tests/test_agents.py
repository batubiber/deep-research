import pytest

from app.agents.deduplicator import deduplicate_sources
from app.agents.gap_researcher import gap_researcher_node
from app.agents.graph import graph
from app.agents.planner import _parse_planner_output
from app.agents.researcher import researcher_node
from app.agents.reviewer import _parse_review
from app.agents.writer import writer_node
from app.llm.client import strip_thinking


def test_strip_thinking():
    text = "<think>internal reasoning</think>Final answer here"
    assert strip_thinking(text) == "Final answer here"


def test_strip_thinking_multiline():
    text = "<think>\nline1\nline2\n</think>\nResult"
    assert strip_thinking(text) == "Result"


def test_strip_thinking_no_think():
    text = "No thinking block"
    assert strip_thinking(text) == "No thinking block"


def test_parse_planner_output():
    text = """**Complexity:** Moderate

**Main Question:** What is quantum computing?

**Subquestions:**
1. What are the basic principles of quantum computing?
2. How does quantum computing differ from classical computing?
3. What are the current applications of quantum computing?

**Suggested search types per sub-question:**
1. [Wikipedia]
2. [Web Search]
3. [ArXiv]"""

    result = _parse_planner_output(text)
    assert result["complexity"] == "moderate"
    assert result["main_question"] == "What is quantum computing?"
    assert len(result["sub_questions"]) == 3
    assert result["sub_questions"][0]["suggested_tool"] == "wikipedia"
    assert result["sub_questions"][2]["suggested_tool"] == "arxiv"


def test_parse_review():
    text = """**Overall Quality Score:** [8]
Some justification here.

**Additional Research Queries:**
1. "quantum error correction latest advances"
2. "quantum supremacy Google 2024"
3. "quantum computing applications healthcare"
"""
    result = _parse_review(text)
    assert result["score"] == 8
    assert len(result["gaps"]) == 3


def test_graph_compilation():
    assert graph is not None
    nodes = list(graph.nodes.keys())
    assert "planner" in nodes
    assert "research_assistant" in nodes
    assert "deduplicator" in nodes
    assert "analyst" in nodes
    assert "reviewer" in nodes
    assert "gap_researcher" in nodes
    assert "writer" in nodes


# --- _parse_review robustness ---

def test_parse_review_quoted_gaps():
    text = """**Overall Quality Score:** [8]

**Additional Research Queries:**
1. "quantum error correction latest advances"
2. "quantum supremacy Google 2024"
3. "quantum computing applications healthcare"
"""
    result = _parse_review(text)
    assert result["score"] == 8
    assert len(result["gaps"]) == 3
    assert result["gaps"][0] == "quantum error correction latest advances"


def test_parse_review_unquoted_gaps():
    text = """**Overall Quality Score:** [6]

**Identified Gaps:**
1. Latest benchmark results for GPT-4o on reasoning tasks — impact: critical
2. Carbon footprint of large language model training — impact: sustainability
3. EU AI Act compliance requirements — impact: regulatory context

**Additional Research Queries:**
1. GPT-4o reasoning benchmark 2024
2. LLM training carbon emissions study
3. EU AI Act compliance enterprise guide
"""
    result = _parse_review(text)
    assert result["score"] == 6
    assert len(result["gaps"]) == 3
    assert "GPT-4o" in result["gaps"][0]


def test_parse_review_empty_fallback():
    text = """**Overall Quality Score:** [5]
No gaps identified."""
    result = _parse_review(text)
    assert result["score"] == 5
    assert result["gaps"] == []


def test_parse_review_max_three_gaps():
    text = """**Overall Quality Score:** [7]

**Additional Research Queries:**
1. "topic one"
2. "topic two"
3. "topic three"
4. "topic four"
5. "topic five"
"""
    result = _parse_review(text)
    assert len(result["gaps"]) == 3


# --- Researcher early-return ---

async def test_researcher_early_return_no_sources(monkeypatch):
    llm_called = []

    async def fake_chat(messages, **kwargs):
        llm_called.append(True)
        return "hallucinated content"

    async def fake_empty(query, max_results=3):
        return []

    import app.agents.researcher as researcher_module
    monkeypatch.setattr("app.agents.researcher.chat", fake_chat)
    monkeypatch.setattr("app.agents.researcher.web_search", fake_empty)
    # TOOL_DISPATCH holds direct references — must patch the dict too
    monkeypatch.setitem(researcher_module.TOOL_DISPATCH, "web_search", fake_empty)
    monkeypatch.setitem(researcher_module.TOOL_DISPATCH, "arxiv", fake_empty)
    monkeypatch.setitem(researcher_module.TOOL_DISPATCH, "wikipedia", fake_empty)

    state = {
        "query": "test query",
        "sub_question": {"id": 2, "question": "What is X?", "suggested_tool": "web_search"},
    }
    result = await researcher_node(state)
    assert llm_called == []
    assert result["raw_sources"][0]["researcher_analysis"] == "No results found for this sub-question."


# --- Gap researcher guards ---

async def test_gap_researcher_no_gaps_skips_llm(monkeypatch):
    llm_called = []

    async def fake_chat(messages, **kwargs):
        llm_called.append(True)
        return "should not be called"

    monkeypatch.setattr("app.agents.gap_researcher.chat", fake_chat)

    state = {"query": "test", "main_question": "q", "review": {"gaps": []}, "raw_sources": []}
    result = await gap_researcher_node(state)
    assert llm_called == []
    assert "No gaps" in result["gap_findings"]


async def test_gap_researcher_empty_search_skips_llm(monkeypatch):
    llm_called = []

    async def fake_chat(messages, **kwargs):
        llm_called.append(True)
        return "hallucinated"

    async def fake_empty(query, max_results=2):
        return []

    monkeypatch.setattr("app.agents.gap_researcher.chat", fake_chat)
    monkeypatch.setattr("app.agents.gap_researcher.web_search", fake_empty)

    state = {"query": "test", "main_question": "q", "review": {"gaps": ["missing topic"]}, "raw_sources": []}
    result = await gap_researcher_node(state)
    assert llm_called == []
    assert "no results" in result["gap_findings"].lower()


# --- Writer verified source list ---

async def test_writer_uses_verified_source_list(monkeypatch):
    captured = {}

    async def fake_chat(messages, **kwargs):
        captured["user_msg"] = messages[-1]["content"]
        return "Final report."

    monkeypatch.setattr("app.agents.writer.chat", fake_chat)

    state = {
        "query": "test", "main_question": "q", "complexity": "simple",
        "analysis": "analysis", "review": {"full_review": "review", "score": 8},
        "gap_findings": "gaps", "raw_sources": [],
        "deduplicated_sources": [
            {"title": "OpenAI Blog", "url": "https://openai.com/blog/test", "eet_score": "high"},
            {"title": "ArXiv Paper", "url": "https://arxiv.org/abs/1234.5678", "eet_score": "high"},
        ],
    }
    result = await writer_node(state)
    assert "https://openai.com/blog/test" in captured["user_msg"]
    assert "https://arxiv.org/abs/1234.5678" in captured["user_msg"]
    assert "VERIFIED SOURCE LIST" in captured["user_msg"]
    assert result["final_report"] == "Final report."


async def test_writer_excludes_empty_url_sources(monkeypatch):
    captured = {}

    async def fake_chat(messages, **kwargs):
        captured["user_msg"] = messages[-1]["content"]
        return "Report"

    monkeypatch.setattr("app.agents.writer.chat", fake_chat)

    state = {
        "query": "test", "main_question": "q", "complexity": "simple",
        "analysis": "", "review": {"full_review": "", "score": 5},
        "gap_findings": "", "raw_sources": [],
        "deduplicated_sources": [
            {"title": "Tavily Summary", "url": "", "eet_score": "high"},
            {"title": "Gov Source", "url": "https://example.gov/page", "eet_score": "high"},
        ],
    }
    await writer_node(state)
    assert "Tavily Summary" not in captured["user_msg"]
    assert "https://example.gov/page" in captured["user_msg"]


# --- Source deduplication ---

def test_deduplication_removes_duplicate_urls():
    sources = [
        {"title": "A", "url": "https://example.com/page", "eet_score": "medium"},
        {"title": "B", "url": "https://arxiv.org/abs/1234", "eet_score": "high"},
        {"title": "A-dup", "url": "https://example.com/page", "eet_score": "medium"},
    ]
    result = deduplicate_sources(sources)
    urls = [s["url"] for s in result]
    assert urls.count("https://example.com/page") == 1
    assert len(result) == 2


def test_deduplication_keeps_analysis_entries():
    sources = [
        {"researcher_analysis": "text", "sub_question_id": 1},
        {"title": "Source", "url": "https://example.gov/page", "eet_score": "high"},
        {"researcher_analysis": "text 2", "sub_question_id": 2},
    ]
    result = deduplicate_sources(sources)
    analysis_entries = [s for s in result if "researcher_analysis" in s]
    assert len(analysis_entries) == 2


def test_deduplication_skips_empty_url():
    sources = [
        {"title": "Tavily Summary", "url": "", "eet_score": "high"},
        {"title": "Real Source", "url": "https://nih.gov/page", "eet_score": "high"},
    ]
    result = deduplicate_sources(sources)
    non_analysis = [s for s in result if "researcher_analysis" not in s]
    assert all(s["url"] != "" for s in non_analysis)
    assert len(non_analysis) == 1


def test_deduplication_empty_input():
    assert deduplicate_sources([]) == []
