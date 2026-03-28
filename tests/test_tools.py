import pytest

from app.tools.web_search import SearchResult, get_eet_score, web_search
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
    results = await arxiv_search("attention mechanism", max_results=2)
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
