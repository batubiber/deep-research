from app.agents.prompts import RESEARCHER_PROMPT
from app.agents.state import ResearchState
from app.config import settings
from app.llm.client import chat, strip_thinking
from app.tools.arxiv_search import arxiv_search
from app.tools.jina_reader import jina_search
from app.tools.reddit_search import reddit_search
from app.tools.twitter_search import twitter_search
from app.tools.web_search import web_search
from app.tools.wikipedia_search import wikipedia_search
from app.tools.youtube_search import youtube_search


TOOL_DISPATCH = {
    "web_search": web_search,
    "arxiv": arxiv_search,
    "wikipedia": wikipedia_search,
    "twitter": twitter_search,
    "reddit": reddit_search,
    "youtube": youtube_search,
    "jina_read": jina_search,
}


async def researcher_node(state: dict) -> dict:
    sub_question = state["sub_question"]
    query = state.get("query", "")

    tool_name = sub_question.get("suggested_tool", "web_search")
    search_fn = TOOL_DISPATCH.get(tool_name, web_search)

    try:
        results = await search_fn(sub_question["question"], max_results=3)
    except Exception:
        results = []

    # Fallback to web_search if primary tool returned nothing
    if not results and search_fn is not web_search:
        try:
            results = await web_search(sub_question["question"], max_results=3)
            tool_name = "web_search"
        except Exception:
            results = []

    sources = []
    for r in results:
        sources.append({
            "title": r.title,
            "url": r.url,
            "content": r.content,
            "eet_score": r.eet_score,
            "sub_question_id": sub_question["id"],
            "sub_question": sub_question["question"],
        })

    # If still no sources after fallback, return without calling the LLM
    if not sources:
        return {
            "raw_sources": [{
                "researcher_analysis": "No results found for this sub-question.",
                "sub_question_id": sub_question["id"],
                "sub_question": sub_question["question"],
                "tool_used": tool_name,
            }],
        }

    # Build context for LLM
    sources_text = ""
    for i, s in enumerate(sources, 1):
        sources_text += f"\n### Source {i}: {s['title']}\n"
        sources_text += f"URL: {s['url']}\n"
        sources_text += f"E-E-A-T: {s['eet_score']}\n"
        sources_text += f"Content: {s['content']}\n"

    user_msg = (
        f"Main research question: {query}\n\n"
        f"Sub-question #{sub_question['id']} to research: {sub_question['question']}\n\n"
        f"Search results:{sources_text}\n\n"
        f"Analyze these sources following your output format."
    )

    messages = [
        {"role": "system", "content": RESEARCHER_PROMPT},
        {"role": "user", "content": user_msg},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=settings.thinking_budget_researcher,
        temperature=settings.temperature_researcher,
    )
    cleaned = strip_thinking(response)

    return {
        "raw_sources": sources + [{
            "researcher_analysis": cleaned,
            "sub_question_id": sub_question["id"],
            "sub_question": sub_question["question"],
            "tool_used": tool_name,
        }],
    }
