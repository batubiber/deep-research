import json

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
    """Streaming endpoint — emits SSE progress events per agent, then a __done__ event."""
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

            payload: dict = {"node": node, "output": str(output)[:500]}

            # Enrich planner event with sub-question count + complexity
            if node == "planner" and isinstance(output, dict):
                sub_qs = output.get("sub_questions", [])
                payload["sub_questions"] = len(sub_qs) if isinstance(sub_qs, list) else 3
                payload["complexity"] = output.get("complexity", "")

            # Enrich reviewer event with quality score
            if node == "reviewer" and isinstance(output, dict):
                review = output.get("review", {})
                if isinstance(review, dict):
                    payload["score"] = review.get("score", 0)

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
