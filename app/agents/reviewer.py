import re

from app.agents.prompts import REVIEWER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


def _parse_review(text: str) -> dict:
    score_match = re.search(r"\*\*Overall Quality Score:\*\*\s*\[?(\d+)", text)
    score = int(score_match.group(1)) if score_match else 5

    gaps: list[str] = []

    def _extract_from_block(block: str) -> list[str]:
        quoted = re.findall(r'\d+\.\s+"(.+?)"', block)
        if quoted:
            return quoted[:3]
        unquoted = re.findall(r'\d+\.\s+(?!")(.+?)(?:\s+[—–-]\s+impact:|$)', block, re.MULTILINE)
        return [u.strip() for u in unquoted if u.strip()][:3]

    # Strategy 1: "Additional Research Queries" section (preferred — these are actual search queries)
    queries_match = re.search(
        r"\*\*Additional Research Queries[^*]*\*\*(.+?)(?:\*\*|$)", text, re.DOTALL | re.IGNORECASE
    )
    if queries_match:
        gaps = _extract_from_block(queries_match.group(1))

    # Strategy 2: "Identified Gaps" section
    if not gaps:
        gaps_match = re.search(
            r"\*\*Identified Gaps[^*]*\*\*(.+?)(?:\*\*|$)", text, re.DOTALL | re.IGNORECASE
        )
        if gaps_match:
            gaps = _extract_from_block(gaps_match.group(1))

    # Strategy 3: any quoted numbered item anywhere
    if not gaps:
        gaps = re.findall(r'\d+\.\s+"(.+?)"', text)[:3]

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
