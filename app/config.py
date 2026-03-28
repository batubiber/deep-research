from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # vLLM
    vllm_base_url: str = "https://kent-unurbane-many.ngrok-free.dev/v1"
    vllm_api_key: str = "a"
    vllm_model_name: str = "qwen3-5"

    # Thinking budgets
    thinking_budget_planner: int = 1024
    thinking_budget_researcher: int = 4096
    thinking_budget_analyst: int = 2048
    thinking_budget_reviewer: int = 1024
    thinking_budget_gap_researcher: int = 4096
    thinking_budget_writer: int = 8192

    # Temperature
    temperature_planner: float = 0.1
    temperature_researcher: float = 0.1
    temperature_analyst: float = 0.2
    temperature_reviewer: float = 0.1
    temperature_gap_researcher: float = 0.1
    temperature_writer: float = 0.4

    # Parallelism
    max_parallel_researchers: int = 4

    # API
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    api_key: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
