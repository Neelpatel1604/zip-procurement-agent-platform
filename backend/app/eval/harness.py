from __future__ import annotations

import json
import re
from typing import Any

import anthropic
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import AgentRun, EvalScore, GoldenSet
from app.engine.runner import run_agent


def _extract_recommendation(text: str) -> str | None:
    lowered = text.lower()
    for label in ("block", "merge_review", "allow"):
        if re.search(rf"\brecommendation[\"']?\s*[:=]\s*[\"']?{label}\b", lowered):
            return label
        if re.search(rf"\"recommendation\"\s*:\s*\"{label}\"", lowered):
            return label
    # fallback: last occurrence of a known label as standalone decision
    matches = re.findall(r"\b(block|merge_review|allow)\b", lowered)
    return matches[-1] if matches else None


def deterministic_score(expected: str, actual_output: str) -> tuple[float, str, dict[str, Any]]:
    expected_norm = expected.strip().lower()
    got = _extract_recommendation(actual_output)
    if got is None:
        return 0.0, "Could not extract recommendation from output.", {"expected": expected_norm, "got": None}
    ok = got == expected_norm
    return (
        1.0 if ok else 0.0,
        f"Deterministic check: expected={expected_norm}, got={got}.",
        {"expected": expected_norm, "got": got, "match": ok},
    )


def judge_with_claude(
    rubric: str,
    input_text: str,
    output_text: str,
    trace_json: str,
) -> tuple[float, str, dict[str, Any]]:
    settings = get_settings()
    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    prompt = f"""You are an evaluation judge for a procurement AI agent.

Score the agent run against the rubric. Use the FULL execution trace, not only the final answer.

Rubric:
{rubric}

User input:
{input_text}

Final output:
{output_text}

Full execution trace (JSON):
{trace_json[:12000]}

Respond with ONLY valid JSON:
{{
  "score": <float 0.0-1.0 overall>,
  "reasoning": "<short explanation>",
  "metrics": {{
    "grounding": <1-5>,
    "risk_coverage_or_duplicate_accuracy": <1-5>,
    "severity_or_recommendation_quality": <1-5>,
    "actionability": <1-5>,
    "trace_consistency": <1-5>
  }}
}}
"""
    response = client.messages.create(
        model=settings.anthropic_judge_model,
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )
    text = "".join(b.text for b in response.content if getattr(b, "type", None) == "text")
    parsed = _parse_json_object(text)
    score = float(parsed.get("score", 0))
    score = max(0.0, min(1.0, score))
    reasoning = str(parsed.get("reasoning", text))
    metrics = parsed.get("metrics") or {}
    return score, reasoning, metrics


def _parse_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            return json.loads(match.group(0))
        return {"score": 0.0, "reasoning": text, "metrics": {}}


def evaluate_golden_item(session: Session, item: GoldenSet) -> EvalScore:
    run = run_agent(session, item.recipe_id, item.input_text, persist=True)
    if item.expected_answer:
        score, reasoning, breakdown = deterministic_score(item.expected_answer, run.output_text)
    else:
        score, reasoning, breakdown = judge_with_claude(
            item.rubric, item.input_text, run.output_text, run.trace_json
        )
    row = EvalScore(
        golden_set_id=item.id,
        run_id=run.id,
        score=score,
        reasoning=reasoning,
        metric_breakdown=json.dumps(breakdown),
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return row


def run_all_evals(session: Session, recipe_id: str | None = None) -> list[EvalScore]:
    q = session.query(GoldenSet)
    if recipe_id:
        q = q.filter(GoldenSet.recipe_id == recipe_id)
    items = q.order_by(GoldenSet.id.asc()).all()
    return [evaluate_golden_item(session, item) for item in items]


def correct_run(
    session: Session,
    run_id: int,
    corrected_output: str,
    rubric: str | None = None,
) -> GoldenSet:
    run = session.get(AgentRun, run_id)
    if run is None:
        raise ValueError(f"agent_run {run_id} not found")
    default_rubric = (
        rubric
        or "Corrected golden case derived from a human-reviewed failure. "
        "Prefer the corrected expected answer when present; otherwise grade grounding and policy adherence."
    )
    # For duplicate cases, try to extract recommendation as expected_answer
    expected = _extract_recommendation(corrected_output)
    item = GoldenSet(
        recipe_id=run.recipe_id,
        input_text=run.input_text,
        rubric=default_rubric,
        expected_answer=expected,
        source="correction",
    )
    session.add(item)
    session.commit()
    session.refresh(item)
    return item
