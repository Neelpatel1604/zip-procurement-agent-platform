from app.retrieval.base import RetrievalBackend, RetrievalHit
from app.retrieval.moorcheh_backend import MoorchehBackend


def get_retrieval_backend() -> RetrievalBackend:
    return MoorchehBackend()


__all__ = ["RetrievalBackend", "RetrievalHit", "MoorchehBackend", "get_retrieval_backend"]
