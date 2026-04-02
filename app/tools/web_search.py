import asyncio

from tavily import AsyncTavilyClient

from app.config import settings
from app.tools.models import SearchResult, get_eet_score
from app.tools.retry import search_retry


async def _enrich_content(url: str, fallback: str) -> str:
    """Fetch full page content via Jina Reader. Falls back to Tavily snippet."""
    from app.tools.jina_reader import jina_read_url
    try:
        result = await jina_read_url(url)
        content = result.content.strip()
        return content if content else fallback
    except Exception:
        return fallback


@search_retry
async def web_search(query: str, max_results: int = 3) -> list[SearchResult]:
    client = AsyncTavilyClient(api_key=settings.tavily_api_key)
    response = await client.search(query, max_results=max_results)

    candidates = []
    for r in response.get("results", [])[:max_results]:
        url = r.get("url", "")
        if not url:
            continue
        candidates.append((r, url))

    if not candidates:
        return []

    # Enrich all results in parallel — Jina fetches full page; falls back to Tavily snippet
    enriched = await asyncio.gather(
        *[_enrich_content(url, r.get("content", "")) for r, url in candidates],
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
