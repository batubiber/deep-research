import json
import logging
import re
import time

from app.agents.prompts import PLANNER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking

logger = logging.getLogger(__name__)


TOOL_MAP = {
    "web search": "web_search",
    "web_search": "web_search",
    "arxiv": "arxiv",
    "wikipedia": "wikipedia",
    "twitter": "twitter",
    "reddit": "reddit",
    "youtube": "youtube",
    "jina": "jina_read",
}


def _parse_planner_output_regex(text: str) -> dict:
    """Legacy regex parser — used as fallback when JSON parsing fails."""
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
    sq_section = re.search(r"\*\*Subquestions:\*\*(.+?)(?:\*\*Suggested|$)", text, re.DOTALL | re.IGNORECASE)
    if sq_section:
        sq_pattern = re.findall(r"(\d+)\.\s+(.+?)(?=\n\d+\.|\n\n|$)", sq_section.group(1).strip())

    tool_section = re.search(r"\*\*Suggested search types.*?\*\*(.+?)$", text, re.DOTALL | re.IGNORECASE)
    tool_suggestions = {}
    if tool_section:
        for match in re.finditer(
            r"(\d+)\.\s+\[?(Web Search|ArXiv|Wikipedia|Twitter|Reddit|YouTube|Jina)",
            tool_section.group(1),
            re.IGNORECASE,
        ):
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


def _parse_planner_output(text: str) -> dict:
    """Parse planner output — tries JSON first, falls back to regex."""
    stripped = text.strip()

    # Strip markdown code fences if present
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)

    # Try direct JSON parse
    try:
        data = json.loads(stripped)
        return _normalize_planner_json(data)
    except (json.JSONDecodeError, ValueError):
        pass

    # Try extracting JSON object from mixed text
    match = re.search(r'\{.*\}', stripped, re.DOTALL)
    if match:
        try:
            data = json.loads(match.group())
            return _normalize_planner_json(data)
        except (json.JSONDecodeError, ValueError):
            pass

    # Fall back to regex parser
    return _parse_planner_output_regex(text)


def _normalize_planner_json(data: dict) -> dict:
    """Normalize a parsed JSON planner output into the expected format."""
    complexity = str(data.get("complexity", "moderate")).lower()
    if complexity not in ("simple", "moderate", "complex"):
        complexity = "moderate"

    main_q = data.get("main_question", "")
    sub_qs = []
    for sq in data.get("sub_questions", []):
        tool = str(sq.get("suggested_tool", "web_search")).lower()
        if tool not in ("web_search", "arxiv", "wikipedia", "twitter", "reddit", "youtube", "jina_read"):
            tool = TOOL_MAP.get(tool, "web_search")
        sub_qs.append({
            "id": sq.get("id", len(sub_qs) + 1),
            "question": sq.get("question", ""),
            "suggested_tool": tool,
            "sources": [],
            "analysis": {},
        })

    return {
        "complexity": complexity,
        "main_question": main_q,
        "sub_questions": sub_qs,
    }


async def planner_node(state: ResearchState) -> dict:
    logger.info("Planner started (query=%r)", state["query"][:120])
    t0 = time.perf_counter()

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

    elapsed = time.perf_counter() - t0
    logger.info(
        "Planner done in %.1fs — complexity=%s, sub_questions=%d",
        elapsed, parsed["complexity"], len(parsed["sub_questions"]),
    )

    return {
        "complexity": parsed["complexity"],
        "main_question": parsed["main_question"],
        "sub_questions": parsed["sub_questions"],
    }
