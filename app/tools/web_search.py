from tavily import AsyncTavilyClient

from app.config import settings
from app.tools.models import SearchResult, get_eet_score


async def web_search(query: str, max_results: int = 3) -> list[SearchResult]:
    client = AsyncTavilyClient(api_key=settings.tavily_api_key)
    response = await client.search(query, max_results=max_results)

    results = []

    for r in response.get("results", [])[:max_results]:
        url = r.get("url", "")
        if not url:
            continue
        results.append(SearchResult(
            title=r.get("title", ""),
            url=url,
            content=r.get("content", ""),
            eet_score=get_eet_score(url),
        ))

    return results
