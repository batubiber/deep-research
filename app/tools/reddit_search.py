import logging

import httpx

from app.config import settings
from app.tools.models import SearchResult
from app.tools.retry import search_retry

logger = logging.getLogger(__name__)


@search_retry
async def reddit_search(query: str, max_results: int = 5) -> list[SearchResult]:
    headers = {"User-Agent": settings.reddit_user_agent}
    params = {
        "q": query,
        "sort": "relevance",
        "limit": max_results,
        "type": "link",
    }

    async with httpx.AsyncClient(headers=headers, timeout=15) as client:
        resp = await client.get(
            "https://www.reddit.com/search.json", params=params
        )
        resp.raise_for_status()
        data = resp.json()

    results = []
    posts = data.get("data", {}).get("children", [])
    for post in posts[:max_results]:
        p = post.get("data", {})
        title = p.get("title", "")
        subreddit = p.get("subreddit_name_prefixed", "")
        permalink = p.get("permalink", "")
        url = f"https://www.reddit.com{permalink}" if permalink else ""
        selftext = p.get("selftext", "")
        score = p.get("score", 0)
        num_comments = p.get("num_comments", 0)

        content = f"[{subreddit}] (Score: {score}, Comments: {num_comments})\n{selftext}" if selftext else f"[{subreddit}] (Score: {score}, Comments: {num_comments})\n{title}"

        results.append(SearchResult(
            title=title,
            url=url,
            content=content,
            eet_score="low",
        ))

    return results
