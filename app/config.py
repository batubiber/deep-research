from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Tavily
    tavily_api_key: str = ""
    tavily_search_depth: str = "advanced"          # "basic" (1 credit) or "advanced" (2 credits, better relevance)
    tavily_include_raw_content: bool = True         # return full page markdown — eliminates Jina for web search

    # Twitter (optional — cookie auth)
    twitter_ct0: str = ""
    twitter_auth_token: str = ""

    # Reddit
    reddit_user_agent: str = "DeepResearch/0.1.0"

    # Jina Reader (optional)
    jina_api_key: str = ""

    # vLLM
    vllm_base_url: str = "https://kent-unurbane-many.ngrok-free.dev/v1"
    vllm_api_key: str = "a"
    vllm_model_name: str = "qwen3-5"

    # Thinking budgets (model has 265k context; larger budgets improve reasoning quality)
    thinking_budget_planner: int = 1024
    thinking_budget_researcher: int = 8192   # increased: researchers now analyze 3x more content
    thinking_budget_analyst: int = 4096      # increased: analyst receives richer summarizer output
    thinking_budget_reviewer: int = 1024
    thinking_budget_gap_researcher: int = 4096
    thinking_budget_writer: int = 16384      # increased: deeper synthesis for longer reports
    thinking_budget_summarizer: int = 2048
    thinking_budget_citation_verifier: int = 1024

    # Temperature
    temperature_planner: float = 0.1
    temperature_researcher: float = 0.1
    temperature_analyst: float = 0.2
    temperature_reviewer: float = 0.1
    temperature_gap_researcher: float = 0.1
    temperature_writer: float = 0.2
    temperature_summarizer: float = 0.1

    # Researcher iteration
    researcher_max_rounds: int = 3
    researcher_results_per_search: int = 7   # increased: broader coverage per search round

    # ArXiv — papers are the highest-quality sources, enrich as many as possible
    arxiv_results_per_search: int = 10       # fetch more papers (abstracts are cheap)
    arxiv_enrich_count: int = 7              # how many get full HTML via Jina (parallel fetches)

    # Parallelism
    max_parallel_researchers: int = 5

    # LLM request timeout (seconds) — 122B FP8 on 8×A100: worst-case call ~40s, 90s = 2× headroom
    llm_timeout: float = 90.0

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8001
    api_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
