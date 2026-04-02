import logging

from app.agents.state import ResearchState

logger = logging.getLogger(__name__)


def deduplicate_sources(sources: list[dict]) -> list[dict]:
    """
    Remove duplicate source entries by URL.
    - Analysis dicts (containing 'researcher_analysis') are kept as-is.
    - Entries with empty URL are dropped.
    - For duplicate URLs, the first occurrence wins.
    """
    seen_urls: set[str] = set()
    out: list[dict] = []
    for s in sources:
        if "researcher_analysis" in s:
            out.append(s)
            continue
        url = s.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            out.append(s)
    return out


async def deduplicator_node(state: ResearchState) -> dict:
    raw = state.get("raw_sources", [])
    deduped = deduplicate_sources(raw)
    logger.info("Deduplicator: %d raw → %d deduplicated sources", len(raw), len(deduped))
    return {"deduplicated_sources": deduped}
