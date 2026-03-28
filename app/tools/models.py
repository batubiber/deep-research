from dataclasses import dataclass


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
