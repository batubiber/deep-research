import pytest

from app.agents.graph import graph
from app.agents.planner import _parse_planner_output
from app.agents.reviewer import _parse_review
from app.llm.client import strip_thinking


def test_strip_thinking():
    text = "<think>internal reasoning</think>Final answer here"
    assert strip_thinking(text) == "Final answer here"


def test_strip_thinking_multiline():
    text = "<think>\nline1\nline2\n</think>\nResult"
    assert strip_thinking(text) == "Result"


def test_strip_thinking_no_think():
    text = "No thinking block"
    assert strip_thinking(text) == "No thinking block"


def test_parse_planner_output():
    text = """**Complexity:** Moderate

**Main Question:** What is quantum computing?

**Subquestions:**
1. What are the basic principles of quantum computing?
2. How does quantum computing differ from classical computing?
3. What are the current applications of quantum computing?

**Suggested search types per sub-question:**
1. [Wikipedia]
2. [Web Search]
3. [ArXiv]"""

    result = _parse_planner_output(text)
    assert result["complexity"] == "moderate"
    assert result["main_question"] == "What is quantum computing?"
    assert len(result["sub_questions"]) == 3
    assert result["sub_questions"][0]["suggested_tool"] == "wikipedia"
    assert result["sub_questions"][2]["suggested_tool"] == "arxiv"


def test_parse_review():
    text = """**Overall Quality Score:** [8]
Some justification here.

**Additional Research Queries:**
1. "quantum error correction latest advances"
2. "quantum supremacy Google 2024"
3. "quantum computing applications healthcare"
"""
    result = _parse_review(text)
    assert result["score"] == 8
    assert len(result["gaps"]) == 3


def test_graph_compilation():
    assert graph is not None
    nodes = list(graph.nodes.keys())
    assert "planner" in nodes
    assert "research_assistant" in nodes
    assert "analyst" in nodes
    assert "reviewer" in nodes
    assert "gap_researcher" in nodes
    assert "writer" in nodes
