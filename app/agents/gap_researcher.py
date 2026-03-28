from app.agents.prompts import GAP_RESEARCHER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking
from app.tools.web_search import web_search


async def gap_researcher_node(state: ResearchState) -> dict:
    review = state.get("review", {})
    gaps = review.get("gaps", [])

    # Max 3 gaps enforced
    gaps = gaps[:3]

    # Search for each gap
    gap_results = []
    for gap_query in gaps:
        try:
            results = await web_search(gap_query, max_results=2)
            for r in results:
                gap_results.append({
                    "title": r.title,
                    "url": r.url,
                    "content": r.content,
                    "eet_score": r.eet_score,
                    "gap_query": gap_query,
                })
        except Exception:
            gap_results.append({
                "title": "No results found",
                "url": "",
                "content": "",
                "eet_score": "low",
                "gap_query": gap_query,
            })

    # Build context for LLM
    gap_text = ""
    for g in gap_results:
        gap_text += f"\n### Gap Query: {g['gap_query']}\n"
        gap_text += f"Source: {g['title']} (URL: {g['url']})\n"
        gap_text += f"Content: {g['content']}\n"

    user_msg = (
        f"Main question: {state.get('main_question', state['query'])}\n\n"
        f"Reviewer's identified gaps: {gaps}\n\n"
        f"Gap search results:{gap_text}\n\n"
        f"Analyze these gap findings following your output format."
    )

    messages = [
        {"role": "system", "content": GAP_RESEARCHER_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=settings.thinking_budget_gap_researcher,
        temperature=settings.temperature_gap_researcher,
    )
    cleaned = strip_thinking(response)

    return {
        "gap_findings": cleaned,
        "raw_sources": gap_results,
    }
