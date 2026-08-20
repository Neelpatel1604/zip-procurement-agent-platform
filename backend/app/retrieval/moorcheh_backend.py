from __future__ import annotations

import time
from typing import Any

from moorcheh import MoorchehClient

from app.config import get_settings
from app.retrieval.base import RetrievalBackend, RetrievalHit


class MoorchehBackend(RetrievalBackend):
    def __init__(
        self,
        base_url: str | None = None,
        namespace: str | None = None,
    ) -> None:
        settings = get_settings()
        self.base_url = base_url or settings.moorcheh_base_url
        self.namespace = namespace or settings.moorcheh_namespace

    def _client(self) -> MoorchehClient:
        return MoorchehClient(self.base_url)

    def ensure_namespace(self) -> None:
        with self._client() as client:
            existing = client.namespaces.list()
            names = self._extract_namespace_names(existing)
            if self.namespace not in names:
                client.namespaces.create(self.namespace, type="text")

    def ingest(self, documents: list[dict]) -> str:
        self.ensure_namespace()
        with self._client() as client:
            result = client.documents.upload(self.namespace, documents=documents)
            job_id = self._extract_job_id(result)
            if job_id:
                self._poll_upload(client, job_id)
            return job_id or str(result)

    def query(self, query: str, top_k: int = 5) -> list[RetrievalHit]:
        with self._client() as client:
            raw = client.similarity_search.query(
                namespaces=[self.namespace],
                query=query,
                top_k=top_k,
            )
        return self._normalize_hits(raw)

    def _poll_upload(self, client: MoorchehClient, job_id: str, timeout_s: int = 120) -> None:
        deadline = time.time() + timeout_s
        while time.time() < deadline:
            status = client.documents.upload_job_status(self.namespace, job_id)
            state = self._extract_status(status)
            if state in {"completed", "complete", "success", "succeeded"}:
                return
            if state in {"failed", "error"}:
                raise RuntimeError(f"Moorcheh upload failed: {status}")
            time.sleep(1.5)
        raise TimeoutError(f"Moorcheh upload job {job_id} timed out")

    @staticmethod
    def _extract_namespace_names(payload: Any) -> set[str]:
        names: set[str] = set()
        if isinstance(payload, dict):
            items = payload.get("namespaces") or payload.get("data") or payload.get("items") or []
            if isinstance(items, list):
                for item in items:
                    if isinstance(item, str):
                        names.add(item)
                    elif isinstance(item, dict):
                        name = item.get("name") or item.get("namespace") or item.get("id")
                        if name:
                            names.add(str(name))
        elif isinstance(payload, list):
            for item in payload:
                if isinstance(item, str):
                    names.add(item)
                elif isinstance(item, dict):
                    name = item.get("name") or item.get("namespace") or item.get("id")
                    if name:
                        names.add(str(name))
        return names

    @staticmethod
    def _extract_job_id(result: Any) -> str | None:
        if isinstance(result, dict):
            return (
                result.get("job_id")
                or result.get("jobId")
                or (result.get("data") or {}).get("job_id")
            )
        return None

    @staticmethod
    def _extract_status(status: Any) -> str:
        if isinstance(status, dict):
            value = (
                status.get("status")
                or status.get("state")
                or (status.get("data") or {}).get("status")
                or ""
            )
            return str(value).lower()
        return str(status).lower()

    @staticmethod
    def _normalize_hits(raw: Any) -> list[RetrievalHit]:
        hits: list[RetrievalHit] = []
        results = raw
        if isinstance(raw, dict):
            results = (
                raw.get("results")
                or raw.get("hits")
                or raw.get("data")
                or raw.get("documents")
                or []
            )
        if not isinstance(results, list):
            return hits
        for item in results:
            if not isinstance(item, dict):
                continue
            text = (
                item.get("text")
                or item.get("content")
                or item.get("chunk")
                or item.get("summary_text")
                or ""
            )
            doc_id = str(
                item.get("id")
                or item.get("document_id")
                or item.get("doc_id")
                or item.get("label")
                or len(hits)
            )
            score = item.get("score") or item.get("similarity") or item.get("distance")
            try:
                score_f = float(score) if score is not None else None
            except (TypeError, ValueError):
                score_f = None
            meta = {k: v for k, v in item.items() if k not in {"text", "content", "chunk"}}
            hits.append(RetrievalHit(id=doc_id, text=str(text), score=score_f, metadata=meta))
        return hits
