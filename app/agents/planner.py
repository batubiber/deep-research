import re

from app.agents.prompts import PLANNER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


TOOL_MAP = {
    "web search": "web_search",
    "arxiv": "arxiv",
    "wikipedia": "wikipedia",
}


def _parse_planner_output(text: str) -> dict:
    complexity = "moderate"
    complexity_match = re.search(r"\*\*Complexity:\*\*\s*(Simple|Moderate|Complex)", text, re.IGNORECASE)
    if complexity_match:
        complexity = complexity_match.group(1).lower()

    main_q = ""
    main_match = re.search(r"\*\*Main Question:\*\*\s*(.+)", text)
    if main_match:
        main_q = main_match.group(1).strip()

    sub_questions = []
    sq_pattern = re.findall(r"(\d+)\.\s+(.+?)(?=\n\d+\.|\n\*\*|$)", text, re.DOTALL)
    # Filter to only subquestions section
    sq_section = re.search(r"\*\*Subquestions:\*\*(.+?)(?:\*\*Suggested|$)", text, re.DOTALL | re.IGNORECASE)
    if sq_section:
        sq_pattern = re.findall(r"(\d+)\.\s+(.+?)(?=\n\d+\.|\n\n|$)", sq_section.group(1).strip())

    # Parse suggested tools
    tool_section = re.search(r"\*\*Suggested search types.*?\*\*(.+?)$", text, re.DOTALL | re.IGNORECASE)
    tool_suggestions = {}
    if tool_section:
        for match in re.finditer(r"(\d+)\.\s+\[?(Web Search|ArXiv|Wikipedia)", tool_section.group(1), re.IGNORECASE):
            idx = int(match.group(1))
            tool_name = match.group(2).lower().strip()
            tool_suggestions[idx] = TOOL_MAP.get(tool_name, "web_search")

    for idx_str, question in sq_pattern:
        idx = int(idx_str)
        sub_questions.append({
            "id": idx,
            "question": question.strip(),
            "suggested_tool": tool_suggestions.get(idx, "web_search"),
            "sources": [],
            "analysis": {},
        })

    return {
        "complexity": complexity,
        "main_question": main_q,
        "sub_questions": sub_questions,
    }


async def planner_node(state: ResearchState) -> dict:
    messages = [
        {"role": "system", "content": PLANNER_PROMPT},
        {"role": "user", "content": state["query"]},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=settings.thinking_budget_planner,
        temperature=settings.temperature_planner,
    )
    cleaned = strip_thinking(response)
    parsed = _parse_planner_output(cleaned)

    return {
        "complexity": parsed["complexity"],
        "main_question": parsed["main_question"],
        "sub_questions": parsed["sub_questions"],
    }
