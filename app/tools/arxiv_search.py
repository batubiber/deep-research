import asyncio
import logging
import re

import arxiv

from app.tools.models import SearchResult, get_eet_score

logger = logging.getLogger(__name__)


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
        if not content:
            logger.debug("Jina returned empty content for %s, using abstract", entry_id)
            return fallback
        return content
    except Exception as e:
        logger.warning("Full HTML fetch failed for %s (%s), using abstract", entry_id, e)
        return fallback


async def arxiv_search(query: str, max_results: int = 5) -> list[SearchResult]:
    from app.config import settings

    client = arxiv.Client()
    search = arxiv.Search(query=query, max_results=max_results, sort_by=arxiv.SortCriterion.Relevance)
    papers = await asyncio.to_thread(list, client.results(search))

    if not papers:
        return []

    enrich_count = min(settings.arxiv_enrich_count, len(papers))
    logger.info("ArXiv: fetching full HTML for %d/%d papers (query=%r)", enrich_count, len(papers), query)

    # Enrich top N papers in parallel — parallel fetches so latency = slowest single paper
    enriched = await asyncio.gather(
        *[_fetch_paper_html(p.entry_id, p.summary) for p in papers[:enrich_count]],
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
