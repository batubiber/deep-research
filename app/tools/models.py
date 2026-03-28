import re
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass
class SearchResult:
    title: str
    url: str
    content: str
    eet_score: str  # "high" | "medium" | "low"


# ---------- Signal 1: lightweight domain heuristics ----------
# These are NOT a credibility score by themselves — just one of five signals.

_INSTITUTIONAL_TLDS = (".gov", ".edu", ".int", ".mil")

_ACADEMIC_DOMAINS = (
    "arxiv.org", "doi.org", "pubmed", "ncbi.nlm.nih.gov",
    "nature.com", "science.org", "sciencedirect.com",
    "ieee.org", "acm.org", "springer.com", "wiley.com",
)

_DOC_PREFIXES = ("docs.", "developer.", "api.", "learn.", "documentation.")
_DOC_SUFFIXES = (".readthedocs.io",)


def _domain_score(url: str) -> float:
    """URL-based authority signal. Returns 0–2."""
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return 0.0

    url_lower = url.lower()

    if any(host.endswith(tld) for tld in _INSTITUTIONAL_TLDS):
        return 2.0
    if any(d in url_lower for d in _ACADEMIC_DOMAINS):
        return 2.0
    if any(host.startswith(p) for p in _DOC_PREFIXES):
        return 1.5
    if any(host.endswith(s) for s in _DOC_SUFFIXES):
        return 1.5
    if host.endswith(".org"):
        return 0.5
    return 0.0


def _content_depth_score(content: str) -> float:
    """Word count signal. Returns 0–3."""
    wc = len(content.split())
    if wc > 2000:
        return 3.0
    if wc > 800:
        return 2.0
    if wc > 300:
        return 1.0
    return 0.0


def _specificity_score(content: str) -> float:
    """Data density: numbers, percentages, concrete figures. Returns 0–2."""
    hits = len(re.findall(r"\b\d[\d.,]*%?\b", content))
    if hits > 30:
        return 2.0
    if hits > 10:
        return 1.0
    return 0.0


def _reference_score(content: str) -> float:
    """Citation / reference density. Returns 0–2."""
    refs = (
        content.count("http://") + content.count("https://")
        + content.count("doi:") + content.count("et al.")
        + len(re.findall(r"\[\d+\]", content))
        + len(re.findall(r"\(\d{4}\)", content))
    )
    if refs > 10:
        return 2.0
    if refs > 3:
        return 1.0
    return 0.0


def _structure_score(content: str) -> float:
    """Structural organisation: headers, tables, emphasis. Returns 0–1."""
    markers = (
        content.count("##")
        + content.count("|")
        + content.count("**")
    )
    return 1.0 if markers > 10 else 0.0


def get_eet_score(url: str, content: str = "", title: str = "") -> str:
    """Multi-signal credibility assessment.

    Five signals (max 10 points total):
      1. Domain type          0–2  (institutional, academic, docs)
      2. Content depth        0–3  (word count)
      3. Technical specificity 0–2  (numbers, data points)
      4. Reference density    0–2  (citations, DOIs, links)
      5. Structural quality   0–1  (headers, tables, formatting)

    Thresholds: ≥ 6 → high, ≥ 3 → medium, else low.

    When *content* is empty the function degrades gracefully to a
    URL-only heuristic (weaker but backward-compatible).
    """
    domain = _domain_score(url)

    # URL-only fast path (no content available yet)
    if not content:
        if domain >= 1.5:
            return "high"
        if domain >= 0.5:
            return "medium"
        return "low"

    total = (
        domain
        + _content_depth_score(content)
        + _specificity_score(content)
        + _reference_score(content)
        + _structure_score(content)
    )

    if total >= 6.0:
        return "high"
    if total >= 3.0:
        return "medium"
    return "low"
