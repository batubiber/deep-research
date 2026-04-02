import pytest

from app.agents.deduplicator import deduplicate_sources
from app.agents.gap_researcher import gap_researcher_node, _select_gap_tool
from app.agents.graph import graph
from app.agents.planner import _parse_planner_output
from app.agents.researcher import researcher_node, _semantic_chunk, _MAX_CHARS_PER_SOURCE
from app.agents.reviewer import _parse_review
from app.agents.writer import writer_node
from app.agents.citation_verifier import _extract_urls_from_report
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


# --- Planner JSON parsing ---

def test_parse_planner_output_json():
    text = '''{
  "complexity": "moderate",
  "main_question": "What is quantum computing?",
  "sub_questions": [
    {"id": 1, "question": "What are the basic principles of quantum computing?", "suggested_tool": "wikipedia"},
    {"id": 2, "question": "How does quantum computing differ from classical computing?", "suggested_tool": "web_search"},
    {"id": 3, "question": "What are the current applications?", "suggested_tool": "arxiv"}
  ]
}'''
    result = _parse_planner_output(text)
    assert result["complexity"] == "moderate"
    assert result["main_question"] == "What is quantum computing?"
    assert len(result["sub_questions"]) == 3
    assert result["sub_questions"][0]["suggested_tool"] == "wikipedia"
    assert result["sub_questions"][2]["suggested_tool"] == "arxiv"


def test_parse_planner_output_json_code_fence():
    text = '''```json
{
  "complexity": "complex",
  "main_question": "How does AI work?",
  "sub_questions": [
    {"id": 1, "question": "What is machine learning?", "suggested_tool": "web_search"}
  ]
}
```'''
    result = _parse_planner_output(text)
    assert result["complexity"] == "complex"
    assert len(result["sub_questions"]) == 1


def test_parse_planner_output_regex_fallback():
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


# --- Reviewer JSON parsing ---

def test_parse_review_json():
    text = """**Coverage Assessment:**
- Sub-Question 1: SUFFICIENT — good coverage
- Sub-Question 2: INSUFFICIENT — missing details

**Overall Quality Score:** [8]
Good analysis overall.

```json
{
  "score": 8,
  "gaps": ["quantum error correction advances", "quantum supremacy Google 2024"],
  "coverage": {"1": "sufficient", "2": "insufficient"}
}
```"""
    result = _parse_review(text)
    assert result["score"] == 8
    assert len(result["gaps"]) == 2
    assert result["gaps"][0] == "quantum error correction advances"


def test_parse_review_regex_fallback():
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


# --- Graph compilation ---

def test_graph_compilation():
    assert graph is not None
    nodes = list(graph.nodes.keys())
    assert "planner" in nodes
    assert "research_assistant" in nodes
    assert "deduplicator" in nodes
    assert "summarizer" in nodes
    assert "analyst" in nodes
    assert "reviewer" in nodes
    assert "gap_researcher" in nodes
    assert "gap_integrator" in nodes
    assert "writer" in nodes
    assert "citation_verifier" in nodes


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


async def test_writer_uses_enhanced_analysis(monkeypatch):
    captured = {}

    async def fake_chat(messages, **kwargs):
        captured["user_msg"] = messages[-1]["content"]
        return "Report"

    monkeypatch.setattr("app.agents.writer.chat", fake_chat)

    state = {
        "query": "test", "main_question": "q", "complexity": "simple",
        "analysis": "original analysis", "enhanced_analysis": "enhanced merged analysis",
        "review": {"full_review": "review", "score": 8},
        "gap_findings": "gap text", "raw_sources": [],
        "deduplicated_sources": [],
    }
    await writer_node(state)
    assert "enhanced merged analysis" in captured["user_msg"]
    # gap_findings should NOT appear separately when enhanced_analysis is present
    assert "--- GAP RESEARCH ---" not in captured["user_msg"]


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


# --- Gap researcher tool routing ---

def test_gap_tool_academic_routes_to_arxiv():
    from app.tools.arxiv_search import arxiv_search
    assert _select_gap_tool("DeepSeek-R1 technical report arXiv official paper") is arxiv_search
    assert _select_gap_tool("research paper on GRPO reinforcement learning") is arxiv_search
    assert _select_gap_tool("academic study on MoE architecture") is arxiv_search
    assert _select_gap_tool("preprint transformer attention mechanism") is arxiv_search


def test_gap_tool_twitter_routing():
    from app.tools.twitter_search import twitter_search
    assert _select_gap_tool("public sentiment on AI regulation") is twitter_search
    assert _select_gap_tool("trending opinion on DeepSeek release") is twitter_search


def test_gap_tool_reddit_routing():
    from app.tools.reddit_search import reddit_search
    assert _select_gap_tool("community experience with fine-tuning LLMs") is reddit_search
    assert _select_gap_tool("troubleshoot vLLM inference errors reddit") is reddit_search


def test_gap_tool_default_web_search():
    from app.tools.web_search import web_search
    assert _select_gap_tool("latest DeepSeek-R1 benchmark results") is web_search
    assert _select_gap_tool("GPU pricing H100 2025") is web_search


# --- Semantic chunking ---

def test_semantic_chunk_short_content_passthrough():
    content = "Short article.\n\nOnly two paragraphs.\n\nStill short."
    result = _semantic_chunk(content, "short article")
    assert result == content


def test_semantic_chunk_returns_within_budget():
    # Build content that exceeds the limit
    paragraphs = [f"Paragraph {i} about topic number {i}." * 20 for i in range(200)]
    content = "\n\n".join(paragraphs)
    assert len(content) > _MAX_CHARS_PER_SOURCE
    result = _semantic_chunk(content, "topic number 42")
    assert len(result) <= _MAX_CHARS_PER_SOURCE


def test_semantic_chunk_prioritises_relevant_paragraphs():
    irrelevant = "\n\n".join([f"Unrelated content about cooking and gardening {i}. " * 30 for i in range(50)])
    relevant = "DeepSeek-R1 uses Group Relative Policy Optimization GRPO for reinforcement learning training."
    content = irrelevant + "\n\n" + relevant
    assert len(content) > _MAX_CHARS_PER_SOURCE
    result = _semantic_chunk(content, "DeepSeek-R1 GRPO reinforcement learning")
    assert relevant in result


def test_semantic_chunk_preserves_document_order():
    para_a = "Alpha section about machine learning transformers.\n" * 5
    para_b = "Beta section about quantum computing systems.\n" * 5
    para_c = "Gamma section about machine learning transformers again.\n" * 5
    content = para_a + "\n\n" + para_b + "\n\n" + para_c
    # If content is short enough, order should be preserved
    if len(content) <= _MAX_CHARS_PER_SOURCE:
        result = _semantic_chunk(content, "machine learning transformers")
        assert result.index("Alpha") < result.index("Gamma")


# --- Citation verifier URL extraction ---

def test_extract_urls_from_report():
    report = """Here is the report.
See [Source 1](https://example.com/page) and https://arxiv.org/abs/1234.5678 for details.
Also check http://nih.gov/research."""
    urls = _extract_urls_from_report(report)
    assert "https://example.com/page" in urls
    assert "https://arxiv.org/abs/1234.5678" in urls
    assert "http://nih.gov/research" in urls
    # No trailing punctuation
    assert not any(u.endswith(".") or u.endswith(")") for u in urls)


def test_extract_urls_empty_report():
    assert _extract_urls_from_report("") == set()
    assert _extract_urls_from_report("No URLs here.") == set()


# --- Citation verifier node ---

async def test_citation_verifier_all_verified(monkeypatch):
    """When all URLs are verified, report passes through unchanged."""
    from app.agents.citation_verifier import citation_verifier_node

    state = {
        "final_report": "Report with https://example.com/page source.",
        "deduplicated_sources": [
            {"url": "https://example.com/page", "title": "Example"},
        ],
    }
    result = await citation_verifier_node(state)
    assert result["final_report"] == state["final_report"]
    assert "All citations verified" in result["citation_verification"]


async def test_citation_verifier_fixes_unverified(monkeypatch):
    """When unverified URLs exist, LLM is called to fix them."""
    from app.agents.citation_verifier import citation_verifier_node

    llm_called = []

    async def fake_chat(messages, **kwargs):
        llm_called.append(True)
        return "Fixed report without bad URLs."

    monkeypatch.setattr("app.agents.citation_verifier.chat", fake_chat)

    state = {
        "final_report": "Report cites https://hallucinated.com/fake and https://real.gov/page.",
        "deduplicated_sources": [
            {"url": "https://real.gov/page", "title": "Real Source"},
        ],
    }
    result = await citation_verifier_node(state)
    assert len(llm_called) == 1
    assert "Fixed" in result["citation_verification"]


# --- Gap integrator ---

async def test_gap_integrator_skips_when_no_gaps(monkeypatch):
    from app.agents.gap_integrator import gap_integrator_node

    llm_called = []

    async def fake_chat(messages, **kwargs):
        llm_called.append(True)
        return "should not be called"

    monkeypatch.setattr("app.agents.gap_integrator.chat", fake_chat)

    state = {"analysis": "original analysis", "gap_findings": "No gaps identified by reviewer."}
    result = await gap_integrator_node(state)
    assert llm_called == []
    assert result["enhanced_analysis"] == "original analysis"


async def test_gap_integrator_merges_findings(monkeypatch):
    from app.agents.gap_integrator import gap_integrator_node

    async def fake_chat(messages, **kwargs):
        return "merged analysis with gap data"

    monkeypatch.setattr("app.agents.gap_integrator.chat", fake_chat)

    state = {"analysis": "original analysis", "gap_findings": "New finding about topic X."}
    result = await gap_integrator_node(state)
    assert result["enhanced_analysis"] == "merged analysis with gap data"


# --- Summarizer ---

async def test_summarizer_groups_by_subquestion(monkeypatch):
    from app.agents.summarizer import summarizer_node

    call_count = []

    async def fake_chat(messages, **kwargs):
        call_count.append(True)
        return f"Summary for call {len(call_count)}"

    monkeypatch.setattr("app.agents.summarizer.chat", fake_chat)

    state = {
        "deduplicated_sources": [
            {"title": "S1", "url": "https://a.com", "content": "Content 1", "eet_score": "high",
             "sub_question_id": 1, "sub_question": "What is X?"},
            {"title": "S2", "url": "https://b.com", "content": "Content 2", "eet_score": "medium",
             "sub_question_id": 1, "sub_question": "What is X?"},
            {"title": "S3", "url": "https://c.com", "content": "Content 3", "eet_score": "high",
             "sub_question_id": 2, "sub_question": "How does Y work?"},
            {"researcher_analysis": "Analysis text", "sub_question_id": 1},
        ],
    }
    result = await summarizer_node(state)
    # Should make 2 LLM calls (one per sub-question group)
    assert len(call_count) == 2
    assert "Summary for call 1" in result["summarized_sources"]
    assert "Summary for call 2" in result["summarized_sources"]
    # Researcher analysis should be preserved
    assert "Analysis text" in result["summarized_sources"]
