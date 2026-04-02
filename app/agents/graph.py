import logging
from collections.abc import Callable

from langgraph.graph import StateGraph, END
from langgraph.types import Send

from app.agents.analyst import analyst_node
from app.agents.citation_verifier import citation_verifier_node
from app.agents.deduplicator import deduplicator_node
from app.agents.gap_integrator import gap_integrator_node
from app.agents.gap_researcher import gap_researcher_node
from app.agents.planner import planner_node
from app.agents.researcher import researcher_node
from app.agents.reviewer import reviewer_node
from app.agents.state import ResearchState
from app.agents.summarizer import summarizer_node
from app.agents.writer import writer_node

logger = logging.getLogger(__name__)


def _safe_node(name: str, fn: Callable, *, fatal: bool = False) -> Callable:
    """Wrap an agent node so exceptions are caught and recorded in state.

    Non-fatal nodes log the error and return an empty update so the pipeline
    continues with partial results.  Fatal nodes (planner) re-raise.
    """

    async def wrapper(state):
        try:
            return await fn(state)
        except Exception as e:
            logger.error("Node '%s' failed: %s", name, e, exc_info=True)
            if fatal:
                raise
            prev = state.get("error") or ""
            msg = f"{prev}[{name}] {e}\n" if prev else f"[{name}] {e}\n"
            return {"error": msg}

    wrapper.__name__ = fn.__name__
    return wrapper


def route_to_researchers(state: ResearchState) -> list[Send]:
    return [
        Send("research_assistant", {
            "query": state["query"],
            "sub_question": sq,
        })
        for sq in state["sub_questions"]
    ]


builder = StateGraph(ResearchState)

# Planner is fatal — without sub-questions the pipeline can't continue
builder.add_node("planner", _safe_node("planner", planner_node, fatal=True))
# Researcher has its own internal error handling; wrap for safety
builder.add_node("research_assistant", _safe_node("research_assistant", researcher_node))
# All post-research nodes are non-fatal — partial results are better than nothing
builder.add_node("deduplicator", _safe_node("deduplicator", deduplicator_node))
builder.add_node("summarizer", _safe_node("summarizer", summarizer_node))
builder.add_node("analyst", _safe_node("analyst", analyst_node))
builder.add_node("reviewer", _safe_node("reviewer", reviewer_node))
builder.add_node("gap_researcher", _safe_node("gap_researcher", gap_researcher_node))
builder.add_node("gap_integrator", _safe_node("gap_integrator", gap_integrator_node))
builder.add_node("writer", _safe_node("writer", writer_node))
builder.add_node("citation_verifier", _safe_node("citation_verifier", citation_verifier_node))

builder.set_entry_point("planner")
builder.add_conditional_edges("planner", route_to_researchers)
builder.add_edge("research_assistant", "deduplicator")
builder.add_edge("deduplicator", "summarizer")
builder.add_edge("summarizer", "analyst")
builder.add_edge("analyst", "reviewer")
builder.add_edge("reviewer", "gap_researcher")
builder.add_edge("gap_researcher", "gap_integrator")
builder.add_edge("gap_integrator", "writer")
builder.add_edge("writer", "citation_verifier")
builder.add_edge("citation_verifier", END)

graph = builder.compile()
