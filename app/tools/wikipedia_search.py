import wikipedia

from app.tools.web_search import SearchResult


async def wikipedia_search(query: str, max_results: int = 2) -> list[SearchResult]:
    results = []
    titles = wikipedia.search(query, results=max_results)
    for title in titles:
        try:
            page = wikipedia.page(title, auto_suggest=False)
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
