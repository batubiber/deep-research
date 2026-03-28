import operator
from typing import Annotated, TypedDict


class SubQuestion(TypedDict):
    id: int
    question: str
    suggested_tool: str  # "web_search" | "arxiv" | "wikipedia" | "twitter" | "reddit" | "youtube" | "jina_read"
    sources: list[dict]
    analysis: dict


class ResearchState(TypedDict):
    # Input
    query: str
    complexity: str  # "simple" | "moderate" | "complex"

    # Planner output
    main_question: str
    sub_questions: list[SubQuestion]

    # Pipeline outputs
    raw_sources: Annotated[list, operator.add]
    deduplicated_sources: list[dict]
    analysis: str
    review: dict
    gap_findings: str

    # Final
    final_report: str
    error: str | None
