import re

from app.agents.prompts import REVIEWER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


def _parse_review(text: str) -> dict:
    score_match = re.search(r"\*\*Overall Quality Score:\*\*\s*\[?(\d+)", text)
    score = int(score_match.group(1)) if score_match else 5

    gaps = []
    gap_pattern = re.findall(r"\d+\.\s+\"(.+?)\"", text)
    # Take max 3 gaps
    gaps = gap_pattern[:3]

    return {
        "score": score,
        "gaps": gaps,
        "full_review": text,
    }


async def reviewer_node(state: ResearchState) -> dict:
    user_msg = (
        f"Main question: {state.get('main_question', state['query'])}\n\n"
        f"Analysis:\n{state.get('analysis', '')}\n\n"
        f"Review this research following your output format."
    )

    messages = [
        {"role": "system", "content": REVIEWER_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=settings.thinking_budget_reviewer,
        temperature=settings.temperature_reviewer,
    )
    cleaned = strip_thinking(response)
    review = _parse_review(cleaned)

    return {"review": review}
