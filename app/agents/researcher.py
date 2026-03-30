import json
import logging
import re

from app.agents.prompts import RESEARCHER_PROMPT, RESEARCHER_REFLECTION_PROMPT
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

logger = logging.getLogger(__name__)

_STOP_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to",
    "for", "of", "and", "or", "this", "that", "it", "with", "as", "by", "be",
}

# Max chars per source passed to LLM. At ~4 chars/token, 60k ≈ 15k tokens.
# With 265k context and up to 7 sources, total source content ≈ 105k tokens — well within budget.
_MAX_CHARS_PER_SOURCE = 60_000


def _semantic_chunk(content: str, query: str) -> str:
    """Return full content if short; otherwise select the most query-relevant paragraphs.

    Paragraphs are scored by keyword overlap with the query. The first few paragraphs
    (introduction / abstract) receive a boost since they usually summarise the whole piece.
    Selected paragraphs are returned in their original document order.
    """
    if len(content) <= _MAX_CHARS_PER_SOURCE:
        return content

    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    if not paragraphs:
        return content[:_MAX_CHARS_PER_SOURCE]

    query_words = {w for w in query.lower().split() if w not in _STOP_WORDS and len(w) > 2}

    scored: list[tuple[float, int, str]] = []
    for i, para in enumerate(paragraphs):
        para_lower = para.lower()
        score = sum(1 for w in query_words if w in para_lower)
        boost = 2.0 if i < 3 else 1.0  # intro / abstract paragraphs get priority
        scored.append((score * boost, i, para))

    # Sort by relevance (desc), break ties by position (asc — earlier is better)
    scored.sort(key=lambda x: (-x[0], x[1]))

    selected: set[int] = set()
    budget = 0
    for _, idx, para in scored:
        chunk_len = len(para) + 2  # +2 for the "\n\n" separator
        if budget + chunk_len > _MAX_CHARS_PER_SOURCE:
            continue
        selected.add(idx)
        budget += chunk_len

    # Reconstruct in original document order
    return "\n\n".join(para for i, para in enumerate(paragraphs) if i in selected)


TOOL_DISPATCH = {
    "web_search": web_search,
    "arxiv": arxiv_search,
    "wikipedia": wikipedia_search,
    "twitter": twitter_search,
    "reddit": reddit_search,
    "youtube": youtube_search,
    "jina_read": jina_search,
}


def _format_source(result, sub_question: dict) -> dict:
    """Convert a SearchResult into the raw_sources dict format."""
    return {
        "title": result.title,
        "url": result.url,
        "content": _semantic_chunk(result.content, sub_question["question"]),
        "eet_score": result.eet_score,
        "sub_question_id": sub_question["id"],
        "sub_question": sub_question["question"],
    }


def _source_summaries(sources: list[dict]) -> str:
    """Build a brief summary of collected sources for the reflection prompt."""
    lines = []
    for i, s in enumerate(sources, 1):
        title = s.get("title", "Untitled")
        eet = s.get("eet_score", "unknown")
        content_preview = s.get("content", "")[:200]
        lines.append(f"{i}. [{eet.upper()}] {title}: {content_preview}...")
    return "\n".join(lines)


async def _reflect_on_sources(
    main_query: str,
    sub_question: dict,
    sources: list[dict],
    previous_queries: list[str],
) -> dict:
    """Ask the LLM whether collected sources sufficiently answer the sub-question.

    Returns: {"sufficient": bool, "reason": str, "refined_query": str}
    """
    summaries = _source_summaries(sources)
    prompt = RESEARCHER_REFLECTION_PROMPT

    user_msg = (
        f"Main research question: {main_query}\n"
        f"Sub-question: {sub_question['question']}\n\n"
        f"Previous search queries used: {previous_queries}\n\n"
        f"Sources found so far ({len(sources)} total):\n{summaries}"
    )

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": user_msg},
    ]

    response = await chat(
        messages=messages,
        thinking_budget=512,
        temperature=0.1,
    )
    cleaned = strip_thinking(response)

    # Parse JSON from response
    try:
        # Strip markdown code fences if present
        text = cleaned.strip()
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try extracting JSON object
        match = re.search(r'\{.*\}', cleaned, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                data = {"sufficient": True, "reason": "parse error", "refined_query": ""}
        else:
            data = {"sufficient": True, "reason": "parse error", "refined_query": ""}

    return {
        "sufficient": bool(data.get("sufficient", True)),
        "reason": data.get("reason", ""),
        "refined_query": data.get("refined_query", ""),
    }


async def researcher_node(state: dict) -> dict:
    sub_question = state["sub_question"]
    query = state.get("query", "")

    tool_name = sub_question.get("suggested_tool", "web_search")
    search_fn = TOOL_DISPATCH.get(tool_name, web_search)

    all_sources: list[dict] = []
    search_query = sub_question["question"]
    previous_queries: list[str] = []
    max_rounds = settings.researcher_max_rounds
    # ArXiv papers are the highest-quality sources — use a dedicated (larger) result count
    results_per_search = (
        settings.arxiv_results_per_search
        if tool_name == "arxiv"
        else settings.researcher_results_per_search
    )

    for round_num in range(max_rounds):
        previous_queries.append(search_query)

        try:
            results = await search_fn(search_query, max_results=results_per_search)
        except Exception as e:
            logger.error("Search failed (tool=%s, query=%r): %s", tool_name, search_query, e)
            results = []

        # Fallback to web_search if primary tool returned nothing (first round only)
        if not results and search_fn is not web_search and round_num == 0:
            try:
                results = await web_search(search_query, max_results=results_per_search)
                tool_name = "web_search"
            except Exception as e:
                logger.error("Fallback web_search failed (query=%r): %s", search_query, e)
                results = []

        # Add new sources (skip duplicates by URL)
        existing_urls = {s["url"] for s in all_sources if s.get("url")}
        for r in results:
            if r.url and r.url not in existing_urls:
                all_sources.append(_format_source(r, sub_question))
                existing_urls.add(r.url)

        # Reflection: should we search again?
        if round_num < max_rounds - 1 and all_sources:
            reflection = await _reflect_on_sources(
                query, sub_question, all_sources, previous_queries,
            )
            logger.info(
                "Researcher reflection (SQ %d, round %d): sufficient=%s, reason=%s",
                sub_question["id"], round_num + 1,
                reflection["sufficient"], reflection["reason"],
            )
            if reflection["sufficient"]:
                break
            refined = reflection.get("refined_query", "").strip()
            if refined and refined not in previous_queries:
                search_query = refined
            else:
                break  # No useful refinement possible
        elif not all_sources and round_num < max_rounds - 1:
            # No results at all — try a simplified query
            words = sub_question["question"].split()
            if len(words) > 4:
                search_query = " ".join(words[:5])
            else:
                break

    # If still no sources after all rounds, return without calling the LLM
    if not all_sources:
        return {
            "raw_sources": [{
                "researcher_analysis": "No results found for this sub-question.",
                "sub_question_id": sub_question["id"],
                "sub_question": sub_question["question"],
                "tool_used": tool_name,
            }],
        }

    # Build context for LLM — final analysis of all collected sources
    sources_text = ""
    for i, s in enumerate(all_sources, 1):
        sources_text += f"\n### Source {i}: {s['title']}\n"
        sources_text += f"URL: {s['url']}\n"
        sources_text += f"E-E-A-T: {s['eet_score']}\n"
        sources_text += f"Content: {s['content']}\n"

    user_msg = (
        f"Main research question: {query}\n\n"
        f"Sub-question #{sub_question['id']} to research: {sub_question['question']}\n\n"
        f"Search results ({len(all_sources)} sources from {len(previous_queries)} search rounds):"
        f"{sources_text}\n\n"
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
        "raw_sources": all_sources + [{
            "researcher_analysis": cleaned,
            "sub_question_id": sub_question["id"],
            "sub_question": sub_question["question"],
            "tool_used": tool_name,
        }],
    }
