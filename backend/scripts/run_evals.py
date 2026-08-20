"""Run eval harness over golden_set."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.eval import run_all_evals  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--recipe", default=None, help="Optional recipe id filter")
    args = parser.parse_args()

    init_db()
    session = SessionLocal()
    try:
        scores = run_all_evals(session, recipe_id=args.recipe)
        print(f"Wrote {len(scores)} eval_scores:")
        for s in scores:
            breakdown = json.loads(s.metric_breakdown)
            print(f"  id={s.id} golden={s.golden_set_id} run={s.run_id} score={s.score:.3f} breakdown={breakdown}")
            print(f"    reason: {s.reasoning[:160]}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
