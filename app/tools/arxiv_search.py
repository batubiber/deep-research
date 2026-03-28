import asyncio
import re

import arxiv

from app.tools.models import SearchResult, get_eet_score


async def _fetch_paper_html(entry_id: str, fallback: str) -> str:
    """Fetch full paper content via Jina HTML reader. Falls back to abstract."""
    from app.tools.jina_reader import jina_read_url
    try:
        m = re.search(r'arxiv\.org/abs/([\d.]+)', entry_id)
        if not m:
            return fallback
        html_url = f"https://arxiv.org/html/{m.group(1)}"
        result = await jina_read_url(html_url)
        content = result.content.strip()
        return content if content else fallback
    except Exception:
        return fallback


async def arxiv_search(query: str, max_results: int = 5) -> list[SearchResult]:
    client = arxiv.Client()
    search = arxiv.Search(query=query, max_results=max_results, sort_by=arxiv.SortCriterion.Relevance)
    papers = await asyncio.to_thread(list, client.results(search))

    if not papers:
        return []

    # Enrich top 2 papers in parallel with full HTML content
    enriched = await asyncio.gather(
        *[_fetch_paper_html(p.entry_id, p.summary) for p in papers[:2]],
        return_exceptions=True,
    )

    results = []
    for i, paper in enumerate(papers):
        if i < len(enriched) and not isinstance(enriched[i], Exception):
            content = enriched[i]
        else:
            content = paper.summary
        url = paper.entry_id
        results.append(SearchResult(
            title=paper.title,
            url=url,
            content=content,
            eet_score=get_eet_score(url, content),
        ))

    return results
