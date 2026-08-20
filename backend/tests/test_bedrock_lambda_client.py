"""Unit tests for Bedrock Lambda SSE accumulation (no network)."""

from app.llm.bedrock_lambda import ToolUseBlock, _accumulate_stream


def test_accumulate_text_stream():
    events = [
        {"type": "message_start", "message": {"model": "claude-sonnet-4-6"}},
        {
            "type": "content_block_start",
            "index": 0,
            "content_block": {"type": "text", "text": ""},
        },
        {
            "type": "content_block_delta",
            "index": 0,
            "delta": {"type": "text_delta", "text": "Hello"},
        },
        {
            "type": "content_block_delta",
            "index": 0,
            "delta": {"type": "text_delta", "text": " world"},
        },
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {"stop_reason": "end_turn"}},
        {"type": "message_stop"},
        "[DONE]",
    ]
    msg = _accumulate_stream(iter(events))
    assert msg.text() == "Hello world"
    assert msg.stop_reason == "end_turn"
    assert msg.model == "claude-sonnet-4-6"


def test_accumulate_tool_use_stream():
    events = [
        {
            "type": "content_block_start",
            "index": 0,
            "content_block": {
                "type": "tool_use",
                "id": "toolu_1",
                "name": "api_data",
                "input": {},
            },
        },
        {
            "type": "content_block_delta",
            "index": 0,
            "delta": {"type": "input_json_delta", "partial_json": '{"sql":'},
        },
        {
            "type": "content_block_delta",
            "index": 0,
            "delta": {
                "type": "input_json_delta",
                "partial_json": ' "SELECT 1"}',
            },
        },
        {"type": "content_block_stop", "index": 0},
        {"type": "message_delta", "delta": {"stop_reason": "tool_use"}},
        "[DONE]",
    ]
    msg = _accumulate_stream(iter(events))
    assert len(msg.content) == 1
    block = msg.content[0]
    assert isinstance(block, ToolUseBlock)
    assert block.name == "api_data"
    assert block.input == {"sql": "SELECT 1"}
    assert msg.stop_reason == "tool_use"
