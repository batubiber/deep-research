from app.agents.prompts import GAP_INTEGRATOR_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking


async def gap_integrator_node(state: ResearchState) -> dict:
    gap_findings = state.get("gap_findings", "")
    analysis = state.get("analysis", "")

    # Skip if no meaningful gap findings
    if not gap_findings or gap_findings.startswith("No gaps"):
        return {"enhanced_analysis": analysis}

    user_msg = (
        f"## Original Analysis\n{analysis}\n\n"
        f"## New Gap Research Findings\n{gap_findings}\n\n"
        f"Merge the gap findings into the original analysis. Where new information "
        f"strengthens, contradicts, or fills gaps in the original, integrate it naturally. "
        f"Preserve all data points from both sources."
    )

    messages = [
        {"role": "system", "content": GAP_INTEGRATOR_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=settings.thinking_budget_gap_researcher,
        temperature=settings.temperature_gap_researcher,
    )
    cleaned = strip_thinking(response)

    return {"enhanced_analysis": cleaned}
