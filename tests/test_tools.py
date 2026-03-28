import pytest

from app.tools.models import SearchResult, get_eet_score
from app.tools.web_search import web_search
from app.tools.arxiv_search import arxiv_search
from app.tools.wikipedia_search import wikipedia_search


def test_eet_score_high():
    assert get_eet_score("https://arxiv.org/abs/1234") == "high"
    assert get_eet_score("https://www.nih.gov/research") == "high"
    assert get_eet_score("https://mit.edu/papers") == "high"


def test_eet_score_medium():
    assert get_eet_score("https://en.wikipedia.org/wiki/Test") == "medium"
    assert get_eet_score("https://www.bbc.com/news") == "medium"


def test_eet_score_low():
    assert get_eet_score("https://random-blog.com/post") == "low"


def test_search_result_dataclass():
    r = SearchResult(title="Test", url="https://test.com", content="Hello", eet_score="low")
    assert r.title == "Test"
    assert r.eet_score == "low"


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
    if results:
        assert results[0].eet_score == "high"


@pytest.mark.asyncio
async def test_wikipedia_search():
    results = await wikipedia_search("artificial intelligence", max_results=1)
    assert isinstance(results, list)
    if results:
        assert results[0].eet_score == "medium"


# --- E-E-A-T domain expansion tests ---

def test_eet_score_new_high_domains():
    assert get_eet_score("https://openai.com/research/gpt4") == "high"
    assert get_eet_score("https://anthropic.com/news/claude") == "high"
    assert get_eet_score("https://huggingface.co/models") == "high"
    assert get_eet_score("https://pytorch.org/docs/stable/") == "high"
    assert get_eet_score("https://tensorflow.org/guide") == "high"
    assert get_eet_score("https://docs.python.org/3/library/") == "high"
    assert get_eet_score("https://developer.mozilla.org/en-US/docs/") == "high"
    assert get_eet_score("https://learn.microsoft.com/en-us/azure/") == "high"
    assert get_eet_score("https://pubmed.ncbi.nlm.nih.gov/12345678/") == "high"


def test_eet_score_subdomain_pattern_high():
    assert get_eet_score("https://docs.djangoproject.com/en/5.0/") == "high"
    assert get_eet_score("https://docs.github.com/en/actions") == "high"
    assert get_eet_score("https://developer.apple.com/documentation/") == "high"
    assert get_eet_score("https://requests.readthedocs.io/en/latest/") == "high"
    assert get_eet_score("https://api.slack.com/methods") == "high"
    assert get_eet_score("https://learn.hashicorp.com/terraform") == "high"


def test_eet_score_demotions():
    assert get_eet_score("https://medium.com/@author/some-post") == "low"
    assert get_eet_score("https://stackoverflow.com/questions/123") == "low"


def test_eet_score_github_still_medium():
    assert get_eet_score("https://github.com/org/repo") == "medium"


def test_eet_score_docs_in_path_does_not_elevate():
    # "docs" in URL path but host is not docs.*
    assert get_eet_score("https://example-blog.com/docs/something") == "low"


# --- web_search: no empty-URL sources ---

@pytest.mark.asyncio
async def test_web_search_no_empty_url_sources(monkeypatch):
    import app.tools.web_search as ws_module

    class FakeTavily:
        async def search(self, query, max_results=3):
            return {
                "answer": "A synthesized answer that should be dropped",
                "results": [
                    {"title": "Real Source", "url": "https://example.gov/page", "content": "content"},
                    {"title": "No URL Result", "url": "", "content": "orphan"},
                ],
            }

    monkeypatch.setattr(ws_module, "AsyncTavilyClient", lambda api_key: FakeTavily())
    results = await ws_module.web_search("test query", max_results=3)
    urls = [r.url for r in results]
    assert "" not in urls
    assert "https://example.gov/page" in urls
    assert len(results) == 1
