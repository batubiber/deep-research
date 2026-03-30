from duckduckgo_search import AsyncDDGS

from app.config import settings
from app.tools.models import SearchResult, get_eet_score


async def _ddg_search(query: str, max_results: int = 3) -> list[SearchResult]:
    """Search using DuckDuckGo and return SearchResult list."""
    async with AsyncDDGS() as ddgs:
        raw = await ddgs.atext(query, max_results=max_results)

    results = []
    for r in raw:
        url = r.get("href", "")
        if not url:
            continue
        content = r.get("body", "")
        results.append(SearchResult(
            title=r.get("title", ""),
            url=url,
            content=content,
            eet_score=get_eet_score(url, content),
        ))

    return results


async def web_search(query: str, max_results: int = 3) -> list[SearchResult]:
    """Provider-aware web search dispatcher.

    Routes to DuckDuckGo or Tavily based on ``settings.search_provider``.
    """
    provider = settings.search_provider.lower()

    if provider == "tavily":
        from app.tools.tavily_search import tavily_search
        return await tavily_search(query, max_results=max_results)

    # Default: DuckDuckGo
    return await _ddg_search(query, max_results=max_results)
