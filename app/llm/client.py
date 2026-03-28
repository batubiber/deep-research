import re

from openai import AsyncOpenAI

from app.config import settings


def get_llm_client() -> AsyncOpenAI:
    return AsyncOpenAI(
        base_url=settings.vllm_base_url,
        api_key=settings.vllm_api_key,
    )


def strip_thinking(text: str) -> str:
    return re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL).strip()


async def chat(
    messages: list[dict],
    thinking_budget: int,
    temperature: float,
    max_tokens: int = 8192,
) -> str:
    client = get_llm_client()
    response = await client.chat.completions.create(
        model=settings.vllm_model_name,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        extra_body={
            "chat_template_kwargs": {
                "enable_thinking": True,
                "thinking_budget": thinking_budget,
            }
        },
    )
    return response.choices[0].message.content
