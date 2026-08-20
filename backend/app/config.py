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

    # Claude via Bedrock Lambda Function URL (streaming)
    bedrock_lambda_url: str = ""
    # Optional overrides; leave empty to use the model configured on the Lambda
    bedrock_model_id: str = ""
    bedrock_judge_model: str = ""

    # Kept for reference / optional fallback docs — app no longer requires this key
    anthropic_api_key: str = ""

    moorcheh_base_url: str = "http://localhost:8080"
    moorcheh_namespace: str = "procurement-docs"
    database_url: str = f"sqlite:///{(BACKEND_ROOT / 'data' / 'procurement.db').as_posix()}"
    max_tool_iterations: int = 3
    recipes_dir: Path = BACKEND_ROOT / "recipes"
    documents_dir: Path = BACKEND_ROOT / "data" / "documents"


@lru_cache
def get_settings() -> Settings:
    return Settings()
