import re

from youtube_transcript_api import YouTubeTranscriptApi

from app.tools.web_search import SearchResult


def _extract_video_id(url: str) -> str:
    patterns = [
        r"(?:v=|/v/|youtu\.be/|/embed/)([a-zA-Z0-9_-]{11})",
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            return match.group(1)
    return url


async def youtube_transcript(video_url: str) -> SearchResult:
    video_id = _extract_video_id(video_url)
    ytt_api = YouTubeTranscriptApi()
    transcript = ytt_api.fetch(video_id)
    text = " ".join(entry.text for entry in transcript.snippets)
    return SearchResult(
        title=f"YouTube Video {video_id}",
        url=video_url,
        content=text,
        eet_score="low",
    )
