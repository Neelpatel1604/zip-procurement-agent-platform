"""CLI: run a single agent recipe."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.engine import list_recipes, run_agent  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Run a procurement agent recipe")
    parser.add_argument("--recipe", required=True, help="Recipe id, e.g. duplicate_vendor_check")
    parser.add_argument("--input", required=True, help="User request text")
    parser.add_argument("--list", action="store_true", help="List recipes and exit")
    args = parser.parse_args()

    if args.list:
        for r in list_recipes():
            print(f"{r['id']}: {r['name']}")
        return

    init_db()
    session = SessionLocal()
    try:
        run = run_agent(session, args.recipe, args.input)
        print("=== OUTPUT ===")
        print(run.output_text)
        print("\n=== TRACE (summary) ===")
        trace = json.loads(run.trace_json)
        for step in trace.get("steps", []):
            print(f"Step {step['iteration']} stop={step.get('stop_reason')}")
            for tc in step.get("tool_calls", []):
                print(f"  tool={tc['name']} args={tc['arguments']}")
                print(f"  result: {tc['result_summary'][:200]}")
        print(f"\nPersisted agent_run id={run.id}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
