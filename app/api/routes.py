import asyncio
import json
import logging
import time
import uuid

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.agents.graph import graph
from app.api.schemas import ResearchRequest, ResearchResponse

logger = logging.getLogger(__name__)
router = APIRouter()

# ---------------------------------------------------------------------------
# Agent node names emitted by the graph
# ---------------------------------------------------------------------------
AGENT_NODE_NAMES = {
    "planner", "research_assistant", "summarizer", "analyst",
    "reviewer", "gap_researcher", "gap_integrator", "writer", "citation_verifier",
}

# ---------------------------------------------------------------------------
# In-memory task store  (no external dependency needed)
# ---------------------------------------------------------------------------
_tasks: dict[str, dict] = {}


def _build_node_payload(node: str, output: dict, data: dict) -> list[dict]:
    """Build one or two SSE payloads for a graph node event."""
    payload: dict = {"node": node, "timestamp": time.time()}

    if node == "planner" and isinstance(output, dict):
        payload["main_question"] = output.get("main_question", "")
        payload["complexity"] = output.get("complexity", "")
        sub_qs = output.get("sub_questions", [])
        payload["sub_questions"] = [
            {"id": sq.get("id"), "question": sq.get("question", ""),
             "suggested_tool": sq.get("suggested_tool", "web_search")}
            for sq in sub_qs
        ] if isinstance(sub_qs, list) else []

    elif node == "research_assistant" and isinstance(output, dict):
        raw = output.get("raw_sources", [])
        sources, analysis = [], ""
        sub_question_id, sub_question, tool_used = 0, "", "web_search"
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
        payload.update(sub_question_id=sub_question_id, sub_question=sub_question,
                       tool_used=tool_used, sources=sources, analysis=analysis)

    elif node == "summarizer" and isinstance(output, dict):
        payload["summarized_sources"] = output.get("summarized_sources", "")[:2000]

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

    elif node == "gap_integrator" and isinstance(output, dict):
        payload["enhanced_analysis"] = output.get("enhanced_analysis", "")[:2000]

    elif node == "citation_verifier" and isinstance(output, dict):
        payload["citation_verification"] = output.get("citation_verification", "")

    payloads = [payload]

    # citation_verifier with final_report → also emit __done__
    if node == "citation_verifier" and isinstance(output, dict) and "final_report" in output:
        input_state = data.get("input", {}) if isinstance(data, dict) else {}
        raw_sources = input_state.get("raw_sources", []) if isinstance(input_state, dict) else []
        payloads.append({
            "node": "__done__",
            "report": output["final_report"],
            "sources_count": len(raw_sources) if isinstance(raw_sources, list) else 0,
        })

    return payloads


# ---------------------------------------------------------------------------
# Background graph runner
# ---------------------------------------------------------------------------
async def _run_graph_task(task_id: str, query: str) -> None:
    task = _tasks[task_id]
    done_sent = False
    try:
        async for event in graph.astream_events({"query": query}, version="v2"):
            if event["event"] != "on_chain_end":
                continue
            node = event.get("name", "")
            if node not in AGENT_NODE_NAMES:
                continue

            data = event.get("data", {})
            output = data.get("output", {}) if isinstance(data, dict) else {}

            for payload in _build_node_payload(node, output, data):
                task["events"].append(payload)
                if payload.get("node") == "__done__":
                    done_sent = True

    except asyncio.CancelledError:
        logger.info("Task %s cancelled", task_id)
        task["events"].append({"node": "__cancelled__", "timestamp": time.time()})
    except Exception as e:
        logger.error("Task %s failed: %s", task_id, e)
        task["events"].append({"node": "__error__", "error": str(e)})
    finally:
        if not done_sent:
            task["events"].append({"node": "__done__", "report": "", "sources_count": 0})
        task["done"] = True


# ---------------------------------------------------------------------------
# Task-based endpoints  (research survives page refresh)
# ---------------------------------------------------------------------------
@router.post("/research/start")
async def start_research(req: ResearchRequest):
    task_id = uuid.uuid4().hex[:8]
    _tasks[task_id] = {
        "query": req.query,
        "events": [],
        "done": False,
        "asyncio_task": None,
    }
    _tasks[task_id]["asyncio_task"] = asyncio.create_task(_run_graph_task(task_id, req.query))
    return {"task_id": task_id}


@router.get("/research/{task_id}/status")
async def task_status(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return {"task_id": task_id, "query": task["query"], "done": task["done"]}


@router.get("/research/{task_id}/events")
async def stream_task_events(
    task_id: str,
    request: Request,
    last_event_id: int = Query(0, ge=0),
):
    """SSE stream that replays events from *last_event_id* then follows live ones.

    Clients can reconnect with ``?last_event_id=N`` to skip already-received
    events instead of replaying the full history.  Each SSE frame includes an
    ``id:`` field so browsers using ``EventSource`` send it back automatically
    via the ``Last-Event-ID`` header.
    """
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    # Standard SSE: browsers send Last-Event-ID header on reconnect
    header_id = request.headers.get("Last-Event-ID")
    start_idx = int(header_id) if header_id and header_id.isdigit() else last_event_id

    async def gen():
        idx = start_idx
        while True:
            # Drain all queued events
            while idx < len(task["events"]):
                yield f"id: {idx}\ndata: {json.dumps(task['events'][idx])}\n\n"
                idx += 1
            if task["done"]:
                break
            await asyncio.sleep(0.3)

    return StreamingResponse(gen(), media_type="text/event-stream")


@router.post("/research/{task_id}/cancel")
async def cancel_research(task_id: str):
    task = _tasks.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    t = task.get("asyncio_task")
    if t and not t.done():
        t.cancel()
        return {"status": "cancelled"}
    return {"status": "already_done"}


# ---------------------------------------------------------------------------
# Legacy endpoints (kept for backwards compatibility)
# ---------------------------------------------------------------------------
@router.post("/research", response_model=ResearchResponse)
async def run_research(req: ResearchRequest) -> ResearchResponse:
    try:
        result = await graph.ainvoke({"query": req.query})
    except Exception as e:
        logger.error("Research pipeline failed for query %r: %s", req.query, e)
        raise HTTPException(status_code=500, detail=str(e))
    return ResearchResponse(
        report=result.get("final_report", ""),
        sources_count=len(result.get("raw_sources", [])),
    )


@router.post("/research/stream")
async def run_research_stream(req: ResearchRequest):
    """Legacy streaming — starts a task and proxies its events."""
    task_id = uuid.uuid4().hex[:8]
    _tasks[task_id] = {"query": req.query, "events": [], "done": False, "asyncio_task": None}
    task = _tasks[task_id]
    task["asyncio_task"] = asyncio.create_task(_run_graph_task(task_id, req.query))

    async def gen():
        idx = 0
        while True:
            while idx < len(task["events"]):
                yield f"data: {json.dumps(task['events'][idx])}\n\n"
                idx += 1
            if task["done"]:
                break
            await asyncio.sleep(0.3)

    return StreamingResponse(gen(), media_type="text/event-stream")
