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


@router.post("/research/stream")
async def run_research_stream(req: ResearchRequest):
    async def event_generator():
        async for event in graph.astream_events(
            {"query": req.query}, version="v2"
        ):
            if event["event"] == "on_chain_end":
                node = event.get("name", "")
                data = event.get("data", {})
                chunk = json.dumps({"node": node, "output": str(data)[:500]})
                yield f"data: {chunk}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
