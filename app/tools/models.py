from dataclasses import dataclass


@dataclass
class SearchResult:
    title: str
    url: str
    content: str
    eet_score: str  # "high" | "medium" | "low"


HIGH_EET_DOMAINS = [
    # Academic / scientific
    ".gov", ".edu",
    "arxiv.org", "nature.com", "science.org", "sciencedirect.com",
    "ieee.org", "acm.org", "springer.com", "wiley.com",
    "nih.gov", "pubmed.ncbi.nlm.nih.gov", "who.int", "un.org",
    # AI / ML official sources
    "openai.com", "anthropic.com", "huggingface.co",
    "pytorch.org", "tensorflow.org",
    # Official language / platform docs
    "docs.python.org", "developer.mozilla.org",
    "learn.microsoft.com", "docs.microsoft.com",
    "cloud.google.com", "developer.apple.com",
]

MEDIUM_EET_DOMAINS = [
    "wikipedia.org", "reuters.com", "apnews.com", "bbc.com",
    "nytimes.com", "theguardian.com", "washingtonpost.com",
    "bloomberg.com", "techcrunch.com", "arstechnica.com",
    "github.com",
]

# Host prefixes/suffixes that indicate official documentation
_HIGH_HOST_PREFIXES = ("docs.", "developer.", "api.", "learn.", "documentation.")
_HIGH_HOST_SUFFIXES = (".readthedocs.io",)


def get_eet_score(url: str) -> str:
    url_lower = url.lower()

    # Extract host for prefix/suffix matching
    try:
        host = url_lower.split("//", 1)[1].split("/", 1)[0]
    except IndexError:
        host = url_lower

    for prefix in _HIGH_HOST_PREFIXES:
        if host.startswith(prefix):
            return "high"
    for suffix in _HIGH_HOST_SUFFIXES:
        if host.endswith(suffix):
            return "high"

    for domain in HIGH_EET_DOMAINS:
        if domain in url_lower:
            return "high"
    for domain in MEDIUM_EET_DOMAINS:
        if domain in url_lower:
            return "medium"
    return "low"
