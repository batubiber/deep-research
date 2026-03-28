from tavily import AsyncTavilyClient

from app.config import settings
from app.tools.models import SearchResult, get_eet_score


async def web_search(query: str, max_results: int = 3) -> list[SearchResult]:
    client = AsyncTavilyClient(api_key=settings.tavily_api_key)
    response = await client.search(query, max_results=max_results)

    results = []

    # Add the synthesized answer as the first source (highest value)
    answer = response.get("answer", "")
    if answer:
        results.append(SearchResult(
            title="Tavily Research Summary",
            url="",
            content=answer,
            eet_score="high",
        ))

    # Add individual sources
    for r in response.get("results", [])[:max_results]:
        url = r.get("url", "")
        results.append(SearchResult(
            title=r.get("title", ""),
            url=url,
            content=r.get("content", ""),
            eet_score=get_eet_score(url),
        ))

    return results
