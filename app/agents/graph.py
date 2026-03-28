from langgraph.graph import StateGraph, END
from langgraph.types import Send

from app.agents.analyst import analyst_node
from app.agents.gap_researcher import gap_researcher_node
from app.agents.planner import planner_node
from app.agents.researcher import researcher_node
from app.agents.reviewer import reviewer_node
from app.agents.state import ResearchState
from app.agents.writer import writer_node


def route_to_researchers(state: ResearchState) -> list[Send]:
    return [
        Send("research_assistant", {
            "query": state["query"],
            "sub_question": sq,
        })
        for sq in state["sub_questions"]
    ]


builder = StateGraph(ResearchState)

builder.add_node("planner", planner_node)
builder.add_node("research_assistant", researcher_node)
builder.add_node("analyst", analyst_node)
builder.add_node("reviewer", reviewer_node)
builder.add_node("gap_researcher", gap_researcher_node)
builder.add_node("writer", writer_node)

builder.set_entry_point("planner")
builder.add_conditional_edges("planner", route_to_researchers)
builder.add_edge("research_assistant", "analyst")
builder.add_edge("analyst", "reviewer")
builder.add_edge("reviewer", "gap_researcher")
builder.add_edge("gap_researcher", "writer")
builder.add_edge("writer", END)

graph = builder.compile()
