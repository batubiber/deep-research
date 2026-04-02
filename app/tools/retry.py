"""Shared retry decorator for all search tools.

Uses exponential backoff: 1s → 2s → 4s, max 3 attempts.
Retries on any exception — callers still see the original error after exhaustion.
"""

import logging

from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    before_sleep_log,
)

logger = logging.getLogger("app.tools.retry")

search_retry = retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=8),
    before_sleep=before_sleep_log(logger, logging.WARNING),
    reraise=True,
)
