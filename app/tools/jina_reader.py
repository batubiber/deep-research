import logging

import httpx

from app.config import settings
from app.tools.models import SearchResult, get_eet_score

logger = logging.getLogger(__name__)

JINA_READER_BASE = "https://r.jina.ai"
JINA_SEARCH_BASE = "https://s.jina.ai"


def _jina_headers() -> dict:
    headers = {"Accept": "text/markdown"}
    if settings.jina_api_key:
        headers["Authorization"] = f"Bearer {settings.jina_api_key}"
    return headers


async def jina_read_url(url: str) -> SearchResult:
    """Read a single URL and return its full content as markdown."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{JINA_READER_BASE}/{url}", headers=_jina_headers()
        )
        resp.raise_for_status()
        content = resp.text

    return SearchResult(
        title=url.split("/")[-1] or url,
        url=url,
        content=content,
        eet_score=get_eet_score(url, content),
    )


async def jina_search(query: str, max_results: int = 3) -> list[SearchResult]:
    """Search via Jina Reader's search endpoint."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            f"{JINA_SEARCH_BASE}/{query}", headers=_jina_headers()
        )
        resp.raise_for_status()
        content = resp.text

    # Jina search returns markdown with multiple results separated by ---
    sections = [s.strip() for s in content.split("---") if s.strip()]

    results = []
    for section in sections[:max_results]:
        # Extract URL from markdown links if present
        url = ""
        title = ""
        lines = section.split("\n")
        for line in lines:
            if line.startswith("URL:"):
                url = line.replace("URL:", "").strip()
            elif line.startswith("Title:"):
                title = line.replace("Title:", "").strip()
            elif line.startswith("# ") and not title:
                title = line.lstrip("# ").strip()

        if not title and lines:
            title = lines[0][:100]

        results.append(SearchResult(
            title=title,
            url=url,
            content=section,
            eet_score=get_eet_score(url, section) if url else "low",
        ))

    return results
