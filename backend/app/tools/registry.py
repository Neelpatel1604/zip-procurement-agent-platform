from __future__ import annotations

import json
from typing import Any, Callable

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.retrieval.base import RetrievalBackend


ToolHandler = Callable[..., str]


def make_document_retrieval_tool(backend: RetrievalBackend) -> dict[str, Any]:
    def handler(query: str, top_k: int = 5) -> str:
        hits = backend.query(query=query, top_k=top_k)
        payload = [
            {
                "id": h.id,
                "score": h.score,
                "text": h.text[:2000],
            }
            for h in hits
        ]
        return json.dumps({"results": payload}, indent=2)

    return {
        "name": "document_retrieval",
        "description": (
            "Semantic search over ingested contract documents (MSA/DPA/NDA). "
            "Use for clause lookup, vendor aliases in contracts, and risk language."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Natural language search query for contract text",
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of chunks to return (default 5)",
                    "default": 5,
                },
            },
            "required": ["query"],
        },
        "handler": handler,
    }


def make_api_data_tool(session: Session) -> dict[str, Any]:
    allowed_prefixes = ("select", "with")

    def handler(sql: str) -> str:
        normalized = sql.strip().lower()
        if not normalized.startswith(allowed_prefixes):
            return json.dumps(
                {"error": "Only read-only SELECT/WITH queries are allowed against the domain DB."}
            )
        forbidden = ["insert", "update", "delete", "drop", "alter", "pragma", "attach"]
        if any(f in normalized for f in forbidden):
            return json.dumps({"error": "Write/DDL statements are not permitted."})
        try:
            result = session.execute(text(sql))
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
            # Serialize dates etc.
            safe_rows = []
            for row in rows:
                safe_rows.append({k: (v.isoformat() if hasattr(v, "isoformat") else v) for k, v in row.items()})
            return json.dumps({"columns": columns, "rows": safe_rows, "count": len(safe_rows)}, indent=2)
        except Exception as exc:  # noqa: BLE001 - surface to model as tool error
            return json.dumps({"error": str(exc)})

    return {
        "name": "api_data",
        "description": (
            "Run a read-only SQL SELECT against the procurement SQLite database. "
            "Tables: vendors(id,name,domain,category), contracts(id,vendor_id,file_path,"
            "effective_date,renewal_date,terms_summary), recipes, agent_runs."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "sql": {
                    "type": "string",
                    "description": "A read-only SQL SELECT statement",
                }
            },
            "required": ["sql"],
        },
        "handler": handler,
    }


def build_tool_registry(
    tool_names: list[str],
    session: Session,
    retrieval: RetrievalBackend,
) -> dict[str, dict[str, Any]]:
    catalog = {
        "document_retrieval": make_document_retrieval_tool(retrieval),
        "api_data": make_api_data_tool(session),
    }
    missing = [n for n in tool_names if n not in catalog]
    if missing:
        raise ValueError(f"Unknown tools in recipe: {missing}")
    return {name: catalog[name] for name in tool_names}
