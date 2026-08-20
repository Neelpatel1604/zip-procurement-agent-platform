from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.config import get_settings
from app.db.models import AgentRun
from app.engine.recipes import load_recipe
from app.llm import get_llm_client
from app.llm.bedrock_lambda import TextBlock, ToolUseBlock
from app.retrieval import get_retrieval_backend
from app.tools import build_tool_registry


def _summarize_tool_result(raw: str, limit: int = 500) -> str:
    raw = raw.strip()
    if len(raw) <= limit:
        return raw
    return raw[:limit] + f"... [truncated {len(raw) - limit} chars]"


def run_agent(
    session: Session,
    recipe_id: str,
    input_text: str,
    *,
    persist: bool = True,
) -> AgentRun:
    """Execute a recipe via Claude tool-use through the Bedrock Lambda URL."""
    settings = get_settings()
    if not settings.bedrock_lambda_url:
        raise RuntimeError(
            "BEDROCK_LAMBDA_URL is not set. Copy .env.example to .env and add the "
            "Function URL from `cdk deploy` (BedrockAnthropicFunctionUrl)."
        )

    recipe = load_recipe(recipe_id)
    retrieval = get_retrieval_backend()
    tools = build_tool_registry(recipe["tools"], session, retrieval)
    anthropic_tools = [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["input_schema"],
        }
        for t in tools.values()
    ]

    client = get_llm_client()
    # Empty model → Lambda uses its BEDROCK_MODEL_ID; recipes may still set a Bedrock id.
    model = recipe.get("model") or settings.bedrock_model_id or None
    system = (
        f"{recipe['system_prompt']}\n\n"
        f"Required output format:\n{recipe['output_format']}"
    )

    messages: list[dict[str, Any]] = [
        {"role": "user", "content": input_text},
    ]

    trace: dict[str, Any] = {
        "recipe_id": recipe_id,
        "model": model or "(lambda-default)",
        "provider": "bedrock_lambda",
        "input": input_text,
        "steps": [],
        "started_at": datetime.now(timezone.utc).isoformat(),
    }

    final_text = ""
    max_iters = settings.max_tool_iterations

    for iteration in range(max_iters):
        response = client.messages_create(
            model=model,
            max_tokens=4096,
            system=system,
            tools=anthropic_tools,
            messages=messages,
        )

        messages.append(response.to_message_dict())

        tool_uses = [b for b in response.content if isinstance(b, ToolUseBlock)]
        text_blocks = [b.text for b in response.content if isinstance(b, TextBlock)]

        step: dict[str, Any] = {
            "iteration": iteration + 1,
            "stop_reason": response.stop_reason,
            "assistant_text": "\n".join(text_blocks),
            "tool_calls": [],
        }

        if not tool_uses or response.stop_reason == "end_turn":
            final_text = "\n".join(text_blocks).strip()
            trace["steps"].append(step)
            break

        tool_results = []
        for tu in tool_uses:
            name = tu.name
            args = tu.input if isinstance(tu.input, dict) else {}
            handler = tools[name]["handler"]
            try:
                raw_result = handler(**args)
            except TypeError:
                raw_result = handler(**{k: v for k, v in args.items()})
            except Exception as exc:  # noqa: BLE001
                raw_result = json.dumps({"error": str(exc)})

            step["tool_calls"].append(
                {
                    "id": tu.id,
                    "name": name,
                    "arguments": args,
                    "result_raw": raw_result,
                    "result_summary": _summarize_tool_result(raw_result),
                }
            )
            tool_results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": tu.id,
                    "content": raw_result,
                }
            )

        trace["steps"].append(step)
        messages.append({"role": "user", "content": tool_results})
    else:
        response = client.messages_create(
            model=model,
            max_tokens=4096,
            system=system
            + "\n\nYou have reached the tool-call limit. Produce the final answer now using prior tool results. Do not call tools.",
            messages=messages,
        )
        final_text = response.text().strip()
        trace["steps"].append(
            {
                "iteration": max_iters + 1,
                "stop_reason": response.stop_reason,
                "assistant_text": final_text,
                "tool_calls": [],
                "note": "forced_synthesis_after_cap",
            }
        )

    if not final_text:
        final_text = "(No textual final output produced.)"

    trace["final_output"] = final_text
    trace["finished_at"] = datetime.now(timezone.utc).isoformat()

    run = AgentRun(
        recipe_id=recipe_id,
        input_text=input_text,
        trace_json=json.dumps(trace, indent=2),
        output_text=final_text,
    )
    if persist:
        session.add(run)
        session.commit()
        session.refresh(run)
    return run
