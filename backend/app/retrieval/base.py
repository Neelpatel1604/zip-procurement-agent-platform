from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class RetrievalHit:
    id: str
    text: str
    score: float | None = None
    metadata: dict | None = None


class RetrievalBackend(ABC):
    """Thin interface so orchestration never depends on a specific vector store."""

    @abstractmethod
    def ingest(self, documents: list[dict]) -> str:
        """Upload documents. Each dict needs id + text. Returns job id or status."""

    @abstractmethod
    def query(self, query: str, top_k: int = 5) -> list[RetrievalHit]:
        """Semantic search over ingested documents."""

    @abstractmethod
    def ensure_namespace(self) -> None:
        """Create namespace if missing."""
