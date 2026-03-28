import re

from app.agents.prompts import CITATION_VERIFIER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


def _extract_urls_from_report(report: str) -> set[str]:
    """Extract all URLs mentioned in the report."""
    raw = re.findall(r'https?://[^\s\)>\]"]+', report)
    # Strip trailing punctuation that isn't part of URLs
    return {url.rstrip(".,;:!?") for url in raw}


async def citation_verifier_node(state: ResearchState) -> dict:
    report = state.get("final_report", "")
    deduped = state.get("deduplicated_sources", [])

    # Build verified URL set
    verified_urls = {
        s["url"] for s in deduped
        if s.get("url") and "researcher_analysis" not in s
    }

    # Extract URLs from report
    report_urls = _extract_urls_from_report(report)

    # Find unverified URLs
    unverified = report_urls - verified_urls
    if not unverified:
        return {"final_report": report, "citation_verification": "All citations verified."}

    # Ask LLM to fix the report — remove or replace unverified citations
    unverified_list = "\n".join(f"- {u}" for u in unverified)
    verified_list = "\n".join(f"- {u}" for u in sorted(verified_urls))

    user_msg = (
        f"The following URLs in the report are NOT in the verified source list:\n"
        f"{unverified_list}\n\n"
        f"Verified source list:\n"
        f"{verified_list}\n\n"
        f"Report:\n{report}\n\n"
        f"Rewrite the report removing or replacing the unverified URLs. "
        f"If a claim relied solely on an unverified source, note that it could not be verified. "
        f"Keep all other content exactly the same."
    )

    messages = [
        {"role": "system", "content": CITATION_VERIFIER_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=settings.thinking_budget_citation_verifier,
        temperature=0.1,
        max_tokens=16384,
    )
    cleaned = strip_thinking(response)

    return {
        "final_report": cleaned,
        "citation_verification": f"Fixed {len(unverified)} unverified citation(s).",
    }
