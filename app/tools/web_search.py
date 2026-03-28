import asyncio
from dataclasses import dataclass

from ddgs import DDGS


@dataclass
class SearchResult:
    title: str
    url: str
    content: str
    eet_score: str  # "high" | "medium" | "low"


HIGH_EET_DOMAINS = [
    ".gov", ".edu", "arxiv.org", "nature.com", "science.org",
    "ieee.org", "acm.org", "nih.gov", "who.int", "un.org",
    "springer.com", "wiley.com", "sciencedirect.com",
]

MEDIUM_EET_DOMAINS = [
    "wikipedia.org", "reuters.com", "apnews.com", "bbc.com",
    "nytimes.com", "theguardian.com", "washingtonpost.com",
    "bloomberg.com", "techcrunch.com", "arstechnica.com",
    "medium.com", "github.com", "stackoverflow.com",
]


def get_eet_score(url: str) -> str:
    url_lower = url.lower()
    for domain in HIGH_EET_DOMAINS:
        if domain in url_lower:
            return "high"
    for domain in MEDIUM_EET_DOMAINS:
        if domain in url_lower:
            return "medium"
    return "low"


async def web_search(query: str, max_results: int = 3) -> list[SearchResult]:
    results = []
    ddgs = DDGS()
    raw = await asyncio.to_thread(ddgs.text, query, max_results=max_results)
    for r in raw:
        results.append(
            SearchResult(
                title=r.get("title", ""),
                url=r.get("href", ""),
                content=r.get("body", ""),
                eet_score=get_eet_score(r.get("href", "")),
            )
        )
    return results
