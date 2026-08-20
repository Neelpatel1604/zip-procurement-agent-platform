"""Client for the Bedrock Anthropic Lambda Function URL (SSE streaming)."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Iterator

import httpx

from app.config import get_settings


@dataclass
class TextBlock:
    type: str = "text"
    text: str = ""


@dataclass
class ToolUseBlock:
    type: str = "tool_use"
    id: str = ""
    name: str = ""
    input: dict[str, Any] = field(default_factory=dict)


ContentBlock = TextBlock | ToolUseBlock


@dataclass
class ClaudeMessage:
    content: list[ContentBlock]
    stop_reason: str | None = None
    model: str | None = None

    def text(self) -> str:
        return "\n".join(b.text for b in self.content if isinstance(b, TextBlock) and b.text)

    def to_message_dict(self) -> dict[str, Any]:
        """Serialize assistant turn for the next request messages array."""
        blocks: list[dict[str, Any]] = []
        for b in self.content:
            if isinstance(b, TextBlock):
                if b.text:
                    blocks.append({"type": "text", "text": b.text})
            elif isinstance(b, ToolUseBlock):
                blocks.append(
                    {
                        "type": "tool_use",
                        "id": b.id,
                        "name": b.name,
                        "input": b.input,
                    }
                )
        return {"role": "assistant", "content": blocks or [{"type": "text", "text": ""}]}


def _normalize_messages(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Ensure message content is JSON-serializable (dicts, not SDK objects)."""
    out: list[dict[str, Any]] = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if isinstance(content, str):
            out.append({"role": role, "content": content})
            continue
        if isinstance(content, list):
            blocks: list[Any] = []
            for item in content:
                if isinstance(item, dict):
                    blocks.append(item)
                elif isinstance(item, TextBlock):
                    blocks.append({"type": "text", "text": item.text})
                elif isinstance(item, ToolUseBlock):
                    blocks.append(
                        {
                            "type": "tool_use",
                            "id": item.id,
                            "name": item.name,
                            "input": item.input,
                        }
                    )
                else:
                    # Anthropic SDK-like objects
                    t = getattr(item, "type", None)
                    if t == "text":
                        blocks.append({"type": "text", "text": getattr(item, "text", "")})
                    elif t == "tool_use":
                        blocks.append(
                            {
                                "type": "tool_use",
                                "id": getattr(item, "id", ""),
                                "name": getattr(item, "name", ""),
                                "input": getattr(item, "input", {}) or {},
                            }
                        )
                    elif t == "tool_result":
                        blocks.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": getattr(item, "tool_use_id", ""),
                                "content": getattr(item, "content", ""),
                            }
                        )
                    else:
                        blocks.append(item)
            out.append({"role": role, "content": blocks})
            continue
        out.append({"role": role, "content": content})
    return out


def _iter_sse_data(lines: Iterator[str]) -> Iterator[dict[str, Any] | str]:
    for raw in lines:
        line = raw.strip()
        if not line or not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload == "[DONE]":
            yield "[DONE]"
            return
        try:
            yield json.loads(payload)
        except json.JSONDecodeError:
            continue


def _accumulate_stream(events: Iterator[dict[str, Any] | str]) -> ClaudeMessage:
    """Rebuild a full message from Bedrock/Anthropic SSE stream events."""
    blocks: dict[int, dict[str, Any]] = {}
    order: list[int] = []
    stop_reason: str | None = None
    model: str | None = None
    json_bufs: dict[int, str] = {}

    for event in events:
        if event == "[DONE]":
            break
        if not isinstance(event, dict):
            continue

        etype = event.get("type")

        if etype == "error":
            raise RuntimeError(event.get("error") or "Bedrock Lambda returned an error")

        if etype == "message_start":
            msg = event.get("message") or {}
            model = msg.get("model") or model

        elif etype == "content_block_start":
            idx = int(event.get("index", 0))
            block = event.get("content_block") or {}
            order.append(idx)
            if block.get("type") == "tool_use":
                blocks[idx] = {
                    "type": "tool_use",
                    "id": block.get("id", ""),
                    "name": block.get("name", ""),
                    "input": block.get("input") or {},
                }
                json_bufs[idx] = ""
            else:
                blocks[idx] = {"type": "text", "text": block.get("text") or ""}

        elif etype == "content_block_delta":
            idx = int(event.get("index", 0))
            delta = event.get("delta") or {}
            dtype = delta.get("type")
            if dtype == "text_delta":
                blocks.setdefault(idx, {"type": "text", "text": ""})
                blocks[idx]["text"] = blocks[idx].get("text", "") + (delta.get("text") or "")
                if idx not in order:
                    order.append(idx)
            elif dtype == "input_json_delta":
                json_bufs[idx] = json_bufs.get(idx, "") + (delta.get("partial_json") or "")

        elif etype == "content_block_stop":
            idx = int(event.get("index", 0))
            if blocks.get(idx, {}).get("type") == "tool_use" and json_bufs.get(idx):
                try:
                    blocks[idx]["input"] = json.loads(json_bufs[idx])
                except json.JSONDecodeError:
                    blocks[idx]["input"] = {"_raw": json_bufs[idx]}

        elif etype == "message_delta":
            delta = event.get("delta") or {}
            if delta.get("stop_reason"):
                stop_reason = delta["stop_reason"]

        # Ignore helper {"type":"text"} duplicates from Lambda

    content: list[ContentBlock] = []
    seen: set[int] = set()
    for idx in order:
        if idx in seen or idx not in blocks:
            continue
        seen.add(idx)
        b = blocks[idx]
        if b["type"] == "tool_use":
            content.append(
                ToolUseBlock(
                    id=str(b.get("id", "")),
                    name=str(b.get("name", "")),
                    input=b.get("input") if isinstance(b.get("input"), dict) else {},
                )
            )
        else:
            content.append(TextBlock(text=str(b.get("text", ""))))

    # Fallback: if only text deltas arrived without block_start
    if not content:
        texts = []
        for idx, b in sorted(blocks.items()):
            if b.get("type") == "text" and b.get("text"):
                texts.append(str(b["text"]))
        if texts:
            content.append(TextBlock(text="".join(texts)))

    return ClaudeMessage(content=content, stop_reason=stop_reason, model=model)


class BedrockLambdaClient:
    def __init__(self, function_url: str | None = None, timeout_s: float = 300.0) -> None:
        settings = get_settings()
        self.function_url = (function_url or settings.bedrock_lambda_url).rstrip("/") + "/"
        self.timeout_s = timeout_s
        self.default_model = settings.bedrock_model_id

    def messages_create(
        self,
        *,
        messages: list[dict[str, Any]],
        system: str | None = None,
        tools: list[dict[str, Any]] | None = None,
        max_tokens: int = 4096,
        temperature: float | None = None,
        model: str | None = None,
        tool_choice: dict[str, Any] | None = None,
    ) -> ClaudeMessage:
        if not self.function_url or self.function_url == "/":
            raise RuntimeError(
                "BEDROCK_LAMBDA_URL is not set. Add it to .env "
                "(from CDK output BedrockAnthropicFunctionUrl)."
            )

        payload: dict[str, Any] = {
            "messages": _normalize_messages(messages),
            "max_tokens": max_tokens,
        }
        if system:
            payload["system"] = system
        if tools:
            payload["tools"] = tools
        if temperature is not None:
            payload["temperature"] = temperature
        if tool_choice:
            payload["tool_choice"] = tool_choice

        # Prefer explicit model, else env Bedrock model id (Lambda default if empty)
        use_model = model or self.default_model
        if use_model:
            payload["model"] = use_model

        with httpx.Client(timeout=self.timeout_s) as client:
            with client.stream(
                "POST",
                self.function_url,
                headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
                json=payload,
            ) as resp:
                if resp.status_code >= 400:
                    body = resp.read().decode("utf-8", errors="replace")
                    raise RuntimeError(f"Bedrock Lambda HTTP {resp.status_code}: {body[:500]}")
                events = _iter_sse_data(resp.iter_lines())
                return _accumulate_stream(events)


def get_llm_client() -> BedrockLambdaClient:
    return BedrockLambdaClient()
