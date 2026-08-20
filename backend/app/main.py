from __future__ import annotations

import json
import queue
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from strawberry.fastapi import GraphQLRouter

from app.db.session import SessionLocal, init_db
from app.engine.runner import run_agent
from app.graphql import schema


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Procurement Agent Platform", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

graphql_app = GraphQLRouter(schema)
app.include_router(graphql_app, prefix="/graphql")


class StreamRunRequest(BaseModel):
    recipe_id: str = Field(..., alias="recipeId")
    input_text: str = Field(..., alias="inputText")

    model_config = {"populate_by_name": True}


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/runs/stream")
def stream_run(body: StreamRunRequest):
    """SSE progress feed while the agent runs (tool starts/ends, final result)."""

    def event_gen():
        events: queue.Queue[dict | None] = queue.Queue()

        def worker() -> None:
            session = SessionLocal()
            try:

                def on_event(event: dict) -> None:
                    events.put(event)

                run_agent(
                    session,
                    body.recipe_id,
                    body.input_text,
                    persist=True,
                    on_event=on_event,
                )
            except Exception as exc:  # noqa: BLE001
                events.put({"type": "error", "error": str(exc), "message": str(exc)})
            finally:
                session.close()
                events.put(None)

        threading.Thread(target=worker, daemon=True).start()

        while True:
            item = events.get()
            if item is None:
                break
            yield f"data: {json.dumps(item, default=str)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
