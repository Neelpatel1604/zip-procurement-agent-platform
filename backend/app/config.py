from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = BACKEND_ROOT.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str = ""
    moorcheh_base_url: str = "http://localhost:8080"
    moorcheh_namespace: str = "procurement-docs"
    database_url: str = f"sqlite:///{(BACKEND_ROOT / 'data' / 'procurement.db').as_posix()}"
    anthropic_agent_model: str = "claude-sonnet-4-20250514"
    anthropic_judge_model: str = "claude-haiku-4-5-20251001"
    max_tool_iterations: int = 3
    recipes_dir: Path = BACKEND_ROOT / "recipes"
    documents_dir: Path = BACKEND_ROOT / "data" / "documents"


@lru_cache
def get_settings() -> Settings:
    return Settings()
