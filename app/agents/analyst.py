from app.agents.prompts import ANALYST_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


async def analyst_node(state: ResearchState) -> dict:
    # Prefer summarized sources (from summarizer node) over raw sources
    summarized = state.get("summarized_sources", "")

    if summarized:
        sources_text = summarized
    else:
        # Fallback to raw sources if summarizer didn't run
        sources_text = ""
        for s in state.get("raw_sources", []):
            if "researcher_analysis" in s:
                sources_text += f"\n--- Researcher Analysis (Sub-Q {s['sub_question_id']}) ---\n"
                sources_text += s["researcher_analysis"] + "\n"
            else:
                sources_text += f"\n--- Source: {s.get('title', 'N/A')} ---\n"
                sources_text += f"URL: {s.get('url', 'N/A')}\n"
                sources_text += f"E-E-A-T: {s.get('eet_score', 'N/A')}\n"
                sources_text += f"Sub-Question: {s.get('sub_question', 'N/A')}\n"
                sources_text += f"Content: {s.get('content', '')}\n"

    user_msg = (
        f"Main question: {state.get('main_question', state['query'])}\n\n"
        f"Complexity: {state.get('complexity', 'moderate')}\n\n"
        f"All collected sources and researcher analyses:\n{sources_text}\n\n"
        f"Perform your deep analysis following your output format."
    )

    messages = [
        {"role": "system", "content": ANALYST_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=settings.thinking_budget_analyst,
        temperature=settings.temperature_analyst,
    )
    cleaned = strip_thinking(response)

    return {"analysis": cleaned}
