from app.agents.prompts import SUMMARIZER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


async def summarizer_node(state: ResearchState) -> dict:
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
        source_text = ""
        for s in group:
            source_text += f"\n### {s['title']} [{s['eet_score'].upper()}]\n"
            source_text += f"URL: {s['url']}\n"
            content = s.get("content", "")
            source_text += f"Content: {content[:30_000]}\n"

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
        summaries.append(strip_thinking(response))

    # Include researcher analyses as-is
    researcher_analyses = "\n\n".join(
        a.get("researcher_analysis", "") for a in analyses if a.get("researcher_analysis")
    )

    summarized = "\n\n---\n\n".join(summaries)
    if researcher_analyses:
        summarized += f"\n\n---\n\nResearcher Analyses:\n{researcher_analyses}"

    return {"summarized_sources": summarized}
