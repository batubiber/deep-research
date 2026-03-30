import os

import pytest

from app.tools.models import SearchResult, get_eet_score
from app.tools.web_search import web_search
from app.tools.arxiv_search import arxiv_search
from app.tools.wikipedia_search import wikipedia_search

_has_tavily_key = bool(os.environ.get("TAVILY_API_KEY", ""))


# ---- helpers for building synthetic content with known signal levels ----

def _deep_cited_content() -> str:
    """~3000 words, many numbers, citations, structured — should score HIGH."""
    body = (
        "## Introduction\n\n"
        "This comprehensive study examines 15 different architectures across 3 benchmarks. "
        "The primary model achieves 89.2% accuracy on MMLU and 76.4% on HumanEval. "
    ) * 30
    refs = "According to Smith et al. (2024), the baseline was 72.1%. [1] [2] [3] [4] [5] "
    refs += "See also https://arxiv.org/abs/2501.12345 and doi:10.1234/example. " * 5
    tables = "\n\n| Model | Params | MMLU | Cost |\n|-------|--------|------|------|\n"
    tables += "| GPT-4 | 1.8T | 86.4% | $30 |\n" * 5
    return body + refs + tables


def _shallow_content() -> str:
    """~50 words, no numbers, no citations — should score LOW on any domain."""
    return "A brief opinion. Not much here. Just my thoughts on the topic."


def _medium_content() -> str:
    """~500 words, some numbers, some refs, light structure — should score MEDIUM on unknown domain."""
    body = "The model has 671 billion parameters and uses MoE architecture. " * 40
    body += "## Key Results\n\nPerformance improved by 12% over baseline. "
    body += "As noted by Lee et al. (2024), the approach builds on prior work. "
    body += "See https://example.com/reference for details. [1] [2] "
    return body


# ============================================================
#  Content-based credibility tests
# ============================================================

def test_deep_content_scores_high_on_any_domain():
    """A personal blog with deep, cited content can score HIGH."""
    content = _deep_cited_content()
    assert get_eet_score("https://some-random-blog.com/analysis", content) == "high"


def test_shallow_content_scores_low_on_any_domain():
    """A shallow page scores LOW even on a well-known domain."""
    assert get_eet_score("https://famous-site.com/page", _shallow_content()) == "low"


def test_medium_content_scores_medium():
    content = _medium_content()
    assert get_eet_score("https://techblog.io/article", content) == "medium"


def test_academic_domain_boosts_score():
    """Domain signal lifts a moderate article from medium to high."""
    content = _medium_content()
    # On a random domain this would be medium
    random_score = get_eet_score("https://random.com/page", content)
    # On an academic domain, the domain signal adds 2 points → should be higher
    academic_score = get_eet_score("https://arxiv.org/abs/2501.12345", content)
    assert academic_score == "high"
    assert random_score in ("medium", "high")  # at least medium


def test_gov_domain_boosts_score():
    content = _medium_content()
    assert get_eet_score("https://energy.gov/report", content) == "high"


def test_doc_subdomain_boosts_above_baseline():
    """Doc subdomains (docs.*, readthedocs.io) give a boost, though less than .gov/.edu."""
    content = _medium_content()
    baseline = get_eet_score("https://random-blog.com/page", content)
    docs_score = get_eet_score("https://docs.python.org/3/library/", content)
    rtd_score = get_eet_score("https://flask.readthedocs.io/en/latest/", content)
    # Doc subdomains should score at least as well as baseline
    level = {"low": 0, "medium": 1, "high": 2}
    assert level[docs_score] >= level[baseline]
    assert level[rtd_score] >= level[baseline]
    # And deep content on doc subdomains should definitely be high
    deep = _deep_cited_content()
    assert get_eet_score("https://docs.python.org/3/library/", deep) == "high"


# ============================================================
#  URL-only fallback (when content is not available yet)
# ============================================================

def test_url_only_institutional_high():
    assert get_eet_score("https://www.nih.gov/research") == "high"
    assert get_eet_score("https://mit.edu/papers") == "high"
    assert get_eet_score("https://arxiv.org/abs/1234") == "high"


def test_url_only_org_medium():
    assert get_eet_score("https://example.org/page") == "medium"


def test_url_only_unknown_low():
    assert get_eet_score("https://random-blog.com/post") == "low"


def test_url_only_docs_prefix_high():
    assert get_eet_score("https://docs.djangoproject.com/en/5.0/") == "high"
    assert get_eet_score("https://developer.apple.com/documentation/") == "high"
    assert get_eet_score("https://requests.readthedocs.io/en/latest/") == "high"


# ============================================================
#  SearchResult dataclass
# ============================================================

def test_search_result_dataclass():
    r = SearchResult(title="Test", url="https://test.com", content="Hello", eet_score="low")
    assert r.title == "Test"
    assert r.eet_score == "low"


# ============================================================
#  Tool integration tests (live API — may skip on rate limit)
# ============================================================

@pytest.mark.asyncio
async def test_web_search():
    results = await web_search("Python programming", max_results=2)
    assert isinstance(results, list)
    assert len(results) <= 2
    if results:
        assert isinstance(results[0], SearchResult)


@pytest.mark.asyncio
async def test_arxiv_search():
    try:
        results = await arxiv_search("attention mechanism", max_results=2)
    except Exception:
        pytest.skip("ArXiv API unavailable or rate limited")
    assert isinstance(results, list)
    assert len(results) <= 2


@pytest.mark.asyncio
async def test_wikipedia_search():
    results = await wikipedia_search("artificial intelligence", max_results=1)
    assert isinstance(results, list)
    if results:
        assert results[0].eet_score == "medium"


# ============================================================
#  web_search: no empty-URL sources
# ============================================================

# ============================================================
#  Tavily search tests (skip when TAVILY_API_KEY not set)
# ============================================================

@pytest.mark.asyncio
@pytest.mark.skipif(not _has_tavily_key, reason="TAVILY_API_KEY not set")
async def test_tavily_search():
    from app.tools.tavily_search import tavily_search
    results = await tavily_search("Python programming", max_results=2)
    assert isinstance(results, list)
    assert len(results) <= 2
    if results:
        assert isinstance(results[0], SearchResult)
        assert results[0].url  # no empty URLs


@pytest.mark.asyncio
async def test_web_search_tavily_dispatch(monkeypatch):
    """web_search dispatches to tavily_search when SEARCH_PROVIDER=tavily."""
    import app.tools.web_search as ws_module
    from app.config import settings

    monkeypatch.setattr(settings, "search_provider", "tavily")

    called = {}

    async def fake_tavily(query, max_results=3):
        called["tavily"] = True
        return [SearchResult(title="Tavily", url="https://example.com", content="ok", eet_score="medium")]

    import app.tools.tavily_search as ts_module
    monkeypatch.setattr(ts_module, "tavily_search", fake_tavily)

    results = await ws_module.web_search("test", max_results=1)
    assert called.get("tavily")
    assert results[0].title == "Tavily"


@pytest.mark.asyncio
async def test_web_search_ddg_dispatch(monkeypatch):
    """web_search dispatches to DuckDuckGo when SEARCH_PROVIDER=duckduckgo."""
    import app.tools.web_search as ws_module
    from app.config import settings

    monkeypatch.setattr(settings, "search_provider", "duckduckgo")

    called = {}

    async def fake_ddg(query, max_results=3):
        called["ddg"] = True
        return [SearchResult(title="DDG", url="https://example.com", content="ok", eet_score="medium")]

    monkeypatch.setattr(ws_module, "_ddg_search", fake_ddg)

    results = await ws_module.web_search("test", max_results=1)
    assert called.get("ddg")
    assert results[0].title == "DDG"


# ============================================================
#  web_search: no empty-URL sources
# ============================================================

@pytest.mark.asyncio
async def test_tavily_search_no_empty_url_sources(monkeypatch):
    import app.tools.tavily_search as ts_module

    class FakeTavily:
        async def search(self, query, max_results=3):
            return {
                "results": [
                    {"title": "Real Source", "url": "https://example.gov/page", "content": "content"},
                    {"title": "No URL Result", "url": "", "content": "orphan"},
                ],
            }

    async def fake_enrich(url, fallback):
        return fallback

    monkeypatch.setattr(ts_module, "AsyncTavilyClient", lambda api_key: FakeTavily())
    monkeypatch.setattr(ts_module, "_enrich_content", fake_enrich)
    results = await ts_module.tavily_search("test query", max_results=3)
    urls = [r.url for r in results]
    assert "" not in urls
    assert "https://example.gov/page" in urls
    assert len(results) == 1
