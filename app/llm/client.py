import logging
import re

from openai import AsyncOpenAI

from app.config import settings

logger = logging.getLogger(__name__)

# Module-level singleton — reuses the underlying HTTP connection pool
_client: AsyncOpenAI | None = None


def get_llm_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(
            base_url=settings.vllm_base_url,
            api_key=settings.vllm_api_key,
            max_retries=0,                    # don't retry timeouts — 2 retries × 300s = 900s blowup
            timeout=settings.llm_timeout,     # configurable via LLM_TIMEOUT env var
        )
    return _client


def strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


async def chat(
    messages: list[dict],
    thinking_budget: int,
    temperature: float,
    max_tokens: int = 8192,
) -> str:
    """Stream the completion so vLLM detects client disconnect and stops generation
    immediately when the task is cancelled or times out."""
    client = get_llm_client()
    chunks: list[str] = []
    try:
        stream = await client.chat.completions.create(
            model=settings.vllm_model_name,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            extra_body={
                "chat_template_kwargs": {
                    "enable_thinking": True,
                    "thinking_budget": thinking_budget,
                }
            },
        )
        async for chunk in stream:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta.content
            if delta:
                chunks.append(delta)
    except Exception as e:
        logger.error("LLM request failed: %s", e)
        raise

    return "".join(chunks)
