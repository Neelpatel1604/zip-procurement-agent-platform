"""Chunk local markdown docs and ingest into Moorcheh."""

from __future__ import annotations

import re
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.config import get_settings  # noqa: E402
from app.retrieval import MoorchehBackend  # noqa: E402


def chunk_text(text: str, chunk_size: int = 900, overlap: int = 120) -> list[str]:
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    if len(text) <= chunk_size:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        # prefer breaking on paragraph
        if end < len(text):
            break_at = text.rfind("\n\n", start, end)
            if break_at > start + chunk_size // 2:
                end = break_at
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return [c for c in chunks if c]


def build_documents() -> list[dict]:
    docs_dir = get_settings().documents_dir
    documents: list[dict] = []
    for path in sorted(docs_dir.glob("*.md")):
        content = path.read_text(encoding="utf-8")
        for i, chunk in enumerate(chunk_text(content)):
            documents.append(
                {
                    "id": f"{path.stem}__chunk_{i}",
                    "text": chunk,
                    "source_file": path.name,
                    "doc_type": path.stem.split("-")[0],
                }
            )
    return documents


def main() -> None:
    backend = MoorchehBackend()
    docs = build_documents()
    print(f"Ingesting {len(docs)} chunks into namespace '{backend.namespace}' at {backend.base_url}...")
    job = backend.ingest(docs)
    print(f"Ingest complete. Job/status: {job}")
    # smoke query
    hits = backend.query("unlimited liability auto-renewal", top_k=3)
    print(f"Smoke query returned {len(hits)} hits.")
    for h in hits:
        print(f"- {h.id} score={h.score} text={h.text[:120]!r}...")


if __name__ == "__main__":
    main()
