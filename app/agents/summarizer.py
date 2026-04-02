import logging
import time

from app.agents.prompts import SUMMARIZER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking

logger = logging.getLogger(__name__)

# Reserve ~15k tokens for system prompt + thinking budget + output + framing.
# Remaining 241k tokens × 4 chars/token = 964k chars, minus 20% safety margin.
_MAX_SUMMARIZER_SOURCE_CHARS = 770_000


async def summarizer_node(state: ResearchState) -> dict:
    t0 = time.perf_counter()
    deduped = state.get("deduplicated_sources", [])

    # Separate actual sources from researcher analyses
    sources = [s for s in deduped if "researcher_analysis" not in s]
    analyses = [s for s in deduped if "researcher_analysis" in s]

    # Group by sub_question_id
    by_sq: dict[int, list[dict]] = {}
    for s in sources:
        sq_id = s.get("sub_question_id", 0)
        by_sq.setdefault(sq_id, []).append(s)

    # Summarize each group via LLM
    summaries = []
    for sq_id, group in sorted(by_sq.items()):
        # Distribute char budget evenly; never exceed per-source cap of 30k
        chars_per_source = min(30_000, _MAX_SUMMARIZER_SOURCE_CHARS // max(len(group), 1))
        source_text = ""
        for s in group:
            source_text += f"\n### {s['title']} [{s['eet_score'].upper()}]\n"
            source_text += f"URL: {s['url']}\n"
            content = s.get("content", "")
            source_text += f"Content: {content[:chars_per_source]}\n"

        sq_question = group[0].get("sub_question", f"Sub-question {sq_id}")
        user_msg = (
            f"Sub-question: {sq_question}\n\n"
            f"Sources:\n{source_text}\n\n"
            f"Summarize each source, preserving specific data points, numbers, dates, "
            f"and key claims. Flag contradictions between sources."
        )

        messages = [
            {"role": "system", "content": SUMMARIZER_PROMPT},
            {"role": "user", "content": user_msg},
        ]

        response = await chat(
            messages=messages,
            thinking_budget=settings.thinking_budget_summarizer,
            temperature=settings.temperature_summarizer,
        )
        header = f"## Sub-Question {sq_id}: {sq_question}"
        summaries.append(f"{header}\n\n{strip_thinking(response)}")

    # Include researcher analyses as-is
    researcher_analyses = "\n\n".join(
        a.get("researcher_analysis", "") for a in analyses if a.get("researcher_analysis")
    )

    summarized = "\n\n---\n\n".join(summaries)
    if researcher_analyses:
        summarized += f"\n\n---\n\nResearcher Analyses:\n{researcher_analyses}"

    elapsed = time.perf_counter() - t0
    logger.info(
        "Summarizer done in %.1fs — %d groups, output=%d chars",
        elapsed, len(by_sq), len(summarized),
    )
    return {"summarized_sources": summarized}
