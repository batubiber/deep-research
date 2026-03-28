import asyncio

import wikipedia

from app.tools.models import SearchResult


async def wikipedia_search(query: str, max_results: int = 2) -> list[SearchResult]:
    results = []
    titles = await asyncio.to_thread(wikipedia.search, query, results=max_results)
    for title in titles:
        try:
            page = await asyncio.to_thread(wikipedia.page, title, auto_suggest=False)
            results.append(
                SearchResult(
                    title=page.title,
                    url=page.url,
                    content=page.summary,
                    eet_score="medium",
                )
            )
        except (wikipedia.DisambiguationError, wikipedia.PageError):
            continue
    return results
