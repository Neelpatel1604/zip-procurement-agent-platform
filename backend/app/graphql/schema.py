from __future__ import annotations

import json
from datetime import datetime
from typing import Optional

import strawberry
from strawberry.types import Info

from app.db.models import AgentRun, EvalScore, Recipe
from app.db.session import SessionLocal
from app.engine import list_recipes, run_agent
from app.eval import correct_run


@strawberry.type
class RecipeType:
    id: str
    name: str
    model: str
    tools: list[str]
    output_format: str


@strawberry.type
class ToolCallType:
    id: str
    name: str
    arguments_json: str
    result_summary: str


@strawberry.type
class TraceStepType:
    iteration: int
    stop_reason: Optional[str]
    assistant_text: str
    tool_calls: list[ToolCallType]
    note: Optional[str] = None


@strawberry.type
class AgentRunType:
    id: int
    recipe_id: str
    input_text: str
    output_text: str
    created_at: datetime
    trace_json: str
    steps: list[TraceStepType]


@strawberry.type
class EvalScoreType:
    id: int
    golden_set_id: int
    run_id: int
    score: float
    reasoning: str
    metric_breakdown: str
    created_at: datetime
    recipe_id: Optional[str] = None


@strawberry.type
class GoldenSetType:
    id: int
    recipe_id: str
    input_text: str
    expected_answer: Optional[str]
    source: str


def _parse_steps(trace_json: str) -> list[TraceStepType]:
    try:
        trace = json.loads(trace_json)
    except json.JSONDecodeError:
        return []
    steps: list[TraceStepType] = []
    for step in trace.get("steps", []):
        tool_calls = [
            ToolCallType(
                id=str(tc.get("id", "")),
                name=str(tc.get("name", "")),
                arguments_json=json.dumps(tc.get("arguments", {})),
                result_summary=str(tc.get("result_summary", "")),
            )
            for tc in step.get("tool_calls", [])
        ]
        steps.append(
            TraceStepType(
                iteration=int(step.get("iteration", 0)),
                stop_reason=step.get("stop_reason"),
                assistant_text=step.get("assistant_text") or "",
                tool_calls=tool_calls,
                note=step.get("note"),
            )
        )
    return steps


def _to_run_type(run: AgentRun) -> AgentRunType:
    return AgentRunType(
        id=run.id,
        recipe_id=run.recipe_id,
        input_text=run.input_text,
        output_text=run.output_text,
        created_at=run.created_at,
        trace_json=run.trace_json,
        steps=_parse_steps(run.trace_json),
    )


@strawberry.type
class Query:
    @strawberry.field
    def recipes(self) -> list[RecipeType]:
        result = []
        for r in list_recipes():
            result.append(
                RecipeType(
                    id=r["id"],
                    name=r["name"],
                    model=r["model"],
                    tools=list(r["tools"]),
                    output_format=r["output_format"],
                )
            )
        return result

    @strawberry.field
    def agent_run(self, id: int) -> Optional[AgentRunType]:
        session = SessionLocal()
        try:
            run = session.get(AgentRun, id)
            return _to_run_type(run) if run else None
        finally:
            session.close()

    @strawberry.field
    def agent_runs(self, limit: int = 20) -> list[AgentRunType]:
        session = SessionLocal()
        try:
            rows = (
                session.query(AgentRun)
                .order_by(AgentRun.id.desc())
                .limit(limit)
                .all()
            )
            return [_to_run_type(r) for r in rows]
        finally:
            session.close()

    @strawberry.field
    def eval_scores(self, limit: int = 50) -> list[EvalScoreType]:
        session = SessionLocal()
        try:
            rows = (
                session.query(EvalScore, AgentRun.recipe_id)
                .join(AgentRun, AgentRun.id == EvalScore.run_id)
                .order_by(EvalScore.id.desc())
                .limit(limit)
                .all()
            )
            out: list[EvalScoreType] = []
            for score, recipe_id in rows:
                out.append(
                    EvalScoreType(
                        id=score.id,
                        golden_set_id=score.golden_set_id,
                        run_id=score.run_id,
                        score=score.score,
                        reasoning=score.reasoning,
                        metric_breakdown=score.metric_breakdown,
                        created_at=score.created_at,
                        recipe_id=recipe_id,
                    )
                )
            return out
        finally:
            session.close()


@strawberry.type
class Mutation:
    @strawberry.mutation
    def run_agent(self, recipe_id: str, input_text: str) -> AgentRunType:
        session = SessionLocal()
        try:
            run = run_agent(session, recipe_id, input_text)
            return _to_run_type(run)
        finally:
            session.close()

    @strawberry.mutation
    def correct_run(
        self,
        run_id: int,
        corrected_output: str,
        rubric: Optional[str] = None,
    ) -> GoldenSetType:
        session = SessionLocal()
        try:
            item = correct_run(session, run_id, corrected_output, rubric)
            return GoldenSetType(
                id=item.id,
                recipe_id=item.recipe_id,
                input_text=item.input_text,
                expected_answer=item.expected_answer,
                source=item.source,
            )
        finally:
            session.close()


schema = strawberry.Schema(query=Query, mutation=Mutation)
