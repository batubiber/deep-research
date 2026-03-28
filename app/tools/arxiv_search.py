import arxiv

from app.tools.web_search import SearchResult, get_eet_score


async def arxiv_search(query: str, max_results: int = 5) -> list[SearchResult]:
    results = []
    client = arxiv.Client()
    search = arxiv.Search(query=query, max_results=max_results, sort_by=arxiv.SortCriterion.Relevance)
    for paper in client.results(search):
        url = paper.entry_id
        results.append(
            SearchResult(
                title=paper.title,
                url=url,
                content=paper.summary,
                eet_score=get_eet_score(url),
            )
        )
    return results
