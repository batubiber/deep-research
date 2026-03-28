import logging

from tavily import AsyncTavilyClient

from app.config import settings
from app.tools.models import SearchResult

logger = logging.getLogger(__name__)


async def twitter_search(query: str, max_results: int = 5) -> list[SearchResult]:
    """Search Twitter/X content via Tavily with domain filtering."""
    client = AsyncTavilyClient(api_key=settings.tavily_api_key)
    response = await client.search(
        query,
        max_results=max_results,
        include_domains=["x.com", "twitter.com"],
    )

    results = []
    for r in response.get("results", []):
        url = r.get("url", "")
        results.append(SearchResult(
            title=r.get("title", ""),
            url=url,
            content=r.get("content", ""),
            eet_score="low",
        ))

    return results
