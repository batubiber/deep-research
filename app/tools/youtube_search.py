import asyncio
import logging

from app.tools.models import SearchResult
from app.tools.retry import search_retry
from app.tools.youtube_transcript import youtube_transcript

logger = logging.getLogger(__name__)


@search_retry
async def youtube_search(query: str, max_results: int = 3) -> list[SearchResult]:
    import yt_dlp

    ydl_opts = {
        "quiet": True,
        "no_warnings": True,
        "extract_flat": True,
        "default_search": f"ytsearch{max_results}",
    }

    info = await asyncio.to_thread(
        lambda: yt_dlp.YoutubeDL(ydl_opts).extract_info(
            f"ytsearch{max_results}:{query}", download=False
        )
    )

    entries = info.get("entries", []) if info else []
    results = []

    for entry in entries[:max_results]:
        video_id = entry.get("id", "")
        title = entry.get("title", f"YouTube Video {video_id}")
        url = entry.get("url", "") or f"https://www.youtube.com/watch?v={video_id}"
        description = entry.get("description", "") or ""

        # Try to fetch transcript for richer content
        content = description
        if video_id:
            try:
                transcript_result = await youtube_transcript(url)
                content = transcript_result.content
            except Exception:
                logger.debug("Transcript unavailable for %s, using description", video_id)

        results.append(SearchResult(
            title=title,
            url=url,
            content=content,
            eet_score="low",
        ))

    return results
