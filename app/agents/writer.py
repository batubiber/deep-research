from app.agents.prompts import WRITER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


async def writer_node(state: ResearchState) -> dict:
    review = state.get("review", {})

    user_msg = (
        f"Main question: {state.get('main_question', state['query'])}\n\n"
        f"Complexity: {state.get('complexity', 'moderate')}\n\n"
        f"--- ANALYSIS ---\n{state.get('analysis', '')}\n\n"
        f"--- REVIEW ---\n{review.get('full_review', '')}\n"
        f"Quality Score: {review.get('score', 'N/A')}\n\n"
        f"--- GAP RESEARCH ---\n{state.get('gap_findings', '')}\n\n"
        f"Total raw sources collected: {len(state.get('raw_sources', []))}\n\n"
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
