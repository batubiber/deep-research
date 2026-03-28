from app.agents.prompts import WRITER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


async def writer_node(state: ResearchState) -> dict:
    review = state.get("review", {})

    # Build a verified source list from deduplicated sources (only citable entries with real URLs)
    deduped = state.get("deduplicated_sources", [])
    citable = [
        s for s in deduped
        if s.get("url") and "researcher_analysis" not in s
    ]
    source_lines = [
        f"{i}. [{s['eet_score'].upper()}] {s['title']} — {s['url']}"
        for i, s in enumerate(citable, 1)
    ]
    sources_block = "\n".join(source_lines) if source_lines else "No citable sources available."

    # Use enhanced_analysis (gap-integrated) if available, otherwise fall back to analysis + gap_findings
    enhanced = state.get("enhanced_analysis", "")
    analysis = enhanced if enhanced else state.get("analysis", "")
    has_gap_integration = bool(enhanced)

    analysis_section = f"--- ANALYSIS ---\n{analysis}\n\n"
    # Only include separate gap section if gap_integrator didn't run
    gap_section = ""
    if not has_gap_integration:
        gap_section = f"--- GAP RESEARCH ---\n{state.get('gap_findings', '')}\n\n"

    user_msg = (
        f"Main question: {state.get('main_question', state['query'])}\n\n"
        f"Complexity: {state.get('complexity', 'moderate')}\n\n"
        f"{analysis_section}"
        f"--- REVIEW ---\n{review.get('full_review', '')}\n"
        f"Quality Score: {review.get('score', 'N/A')}\n\n"
        f"{gap_section}"
        f"--- VERIFIED SOURCE LIST ({len(citable)} sources) ---\n"
        f"{sources_block}\n\n"
        f"IMPORTANT: In the Sources section, ONLY list URLs from the VERIFIED SOURCE LIST above. "
        f"Do not invent or infer any URL not listed above.\n\n"
        f"Write the comprehensive final report following your output format."
    )

    messages = [
        {"role": "system", "content": WRITER_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=settings.thinking_budget_writer,
        temperature=settings.temperature_writer,
        max_tokens=16384,
    )
    cleaned = strip_thinking(response)

    return {"final_report": cleaned}
