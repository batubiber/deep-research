import asyncio

from tavily import AsyncTavilyClient

from app.config import settings
from app.tools.models import SearchResult, get_eet_score
from app.tools.retry import search_retry


async def _enrich_content(url: str, raw_content: str | None, snippet: str) -> str:
    """Return best available content: Tavily raw_content → Jina Reader → snippet."""
    # Prefer Tavily's raw_content (already fetched with include_raw_content)
    if raw_content and raw_content.strip():
        return raw_content.strip()

    # Fallback: try Jina Reader for full page extraction
    from app.tools.jina_reader import jina_read_url
    try:
        result = await jina_read_url(url)
        content = result.content.strip()
        if content:
            return content
    except Exception:
        pass

    return snippet


@search_retry
async def web_search(
    query: str,
    max_results: int = 3,
    topic: str = "general",
) -> list[SearchResult]:
    client = AsyncTavilyClient(api_key=settings.tavily_api_key)

    search_kwargs: dict = {
        "max_results": max_results,
        "search_depth": settings.tavily_search_depth,
    }
    if settings.tavily_include_raw_content:
        search_kwargs["include_raw_content"] = "markdown"
    if topic != "general":
        search_kwargs["topic"] = topic

    response = await client.search(query, **search_kwargs)

    candidates = []
    for r in response.get("results", [])[:max_results]:
        url = r.get("url", "")
        if not url:
            continue
        candidates.append((r, url))

    if not candidates:
        return []

    # Enrich: prefer Tavily raw_content, then Jina, then snippet
    enriched = await asyncio.gather(
        *[
            _enrich_content(url, r.get("raw_content"), r.get("content", ""))
            for r, url in candidates
        ],
        return_exceptions=True,
    )

    results = []
    for i, (r, url) in enumerate(candidates):
        content = enriched[i]
        if isinstance(content, Exception):
            content = r.get("content", "")
        results.append(SearchResult(
            title=r.get("title", ""),
            url=url,
            content=content,
            eet_score=get_eet_score(url, content),
        ))

    return results
