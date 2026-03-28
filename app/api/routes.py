import json
import time

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.agents.graph import graph
from app.api.schemas import ResearchRequest, ResearchResponse

router = APIRouter()


@router.post("/research", response_model=ResearchResponse)
async def run_research(req: ResearchRequest) -> ResearchResponse:
    result = await graph.ainvoke({"query": req.query})
    return ResearchResponse(
        report=result.get("final_report", ""),
        sources_count=len(result.get("raw_sources", [])),
    )


AGENT_NODE_NAMES = {
    "planner", "research_assistant", "analyst",
    "reviewer", "gap_researcher", "writer",
}


@router.post("/research/stream")
async def run_research_stream(req: ResearchRequest):
    """Streaming endpoint — emits rich SSE progress events per agent, then a __done__ event."""
    async def event_generator():
        async for event in graph.astream_events(
            {"query": req.query}, version="v2"
        ):
            if event["event"] != "on_chain_end":
                continue

            node: str = event.get("name", "")
            if node not in AGENT_NODE_NAMES:
                continue

            data = event.get("data", {})
            output = data.get("output", {}) if isinstance(data, dict) else {}

            payload: dict = {"node": node, "timestamp": time.time()}

            if node == "planner" and isinstance(output, dict):
                payload["main_question"] = output.get("main_question", "")
                payload["complexity"] = output.get("complexity", "")
                sub_qs = output.get("sub_questions", [])
                payload["sub_questions"] = [
                    {"id": sq.get("id"), "question": sq.get("question", ""), "suggested_tool": sq.get("suggested_tool", "web_search")}
                    for sq in sub_qs
                ] if isinstance(sub_qs, list) else []

            elif node == "research_assistant" and isinstance(output, dict):
                raw = output.get("raw_sources", [])
                sources = []
                analysis = ""
                sub_question_id = 0
                sub_question = ""
                tool_used = "web_search"
                for item in raw:
                    if not isinstance(item, dict):
                        continue
                    if "researcher_analysis" in item:
                        analysis = item["researcher_analysis"]
                        sub_question_id = item.get("sub_question_id", 0)
                        sub_question = item.get("sub_question", sub_question)
                        tool_used = item.get("tool_used", tool_used)
                    else:
                        sources.append({
                            "title": item.get("title", ""),
                            "url": item.get("url", ""),
                            "content": item.get("content", "")[:300],
                            "eet_score": item.get("eet_score", "low"),
                        })
                        sub_question_id = item.get("sub_question_id", sub_question_id)
                        sub_question = item.get("sub_question", sub_question)
                payload["sub_question_id"] = sub_question_id
                payload["sub_question"] = sub_question
                payload["tool_used"] = tool_used
                payload["sources"] = sources
                payload["analysis"] = analysis

            elif node == "analyst" and isinstance(output, dict):
                payload["analysis"] = output.get("analysis", "")

            elif node == "reviewer" and isinstance(output, dict):
                review = output.get("review", {})
                if isinstance(review, dict):
                    payload["score"] = review.get("score", 0)
                    payload["gaps"] = review.get("gaps", [])
                    payload["full_review"] = review.get("full_review", "")

            elif node == "gap_researcher" and isinstance(output, dict):
                payload["gap_findings"] = output.get("gap_findings", "")
                gap_sources = []
                for item in output.get("raw_sources", []):
                    if isinstance(item, dict):
                        gap_sources.append({
                            "title": item.get("title", ""),
                            "url": item.get("url", ""),
                            "content": item.get("content", "")[:300],
                            "eet_score": item.get("eet_score", "low"),
                            "gap_query": item.get("gap_query", ""),
                        })
                payload["gap_sources"] = gap_sources

            yield f"data: {json.dumps(payload)}\n\n"

            # After writer: emit __done__ with full report
            if node == "writer" and isinstance(output, dict) and "final_report" in output:
                input_state = data.get("input", {}) if isinstance(data, dict) else {}
                raw_sources = input_state.get("raw_sources", []) if isinstance(input_state, dict) else []
                done_payload = {
                    "node": "__done__",
                    "report": output["final_report"],
                    "sources_count": len(raw_sources) if isinstance(raw_sources, list) else 0,
                }
                yield f"data: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
