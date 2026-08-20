"""Close the loop: promote a corrected run into golden_set."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal, init_db  # noqa: E402
from app.eval import correct_run  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", type=int, required=True)
    parser.add_argument("--corrected-output", required=True)
    parser.add_argument("--rubric", default=None)
    args = parser.parse_args()

    init_db()
    session = SessionLocal()
    try:
        item = correct_run(session, args.run_id, args.corrected_output, args.rubric)
        print(
            f"Inserted golden_set id={item.id} recipe={item.recipe_id} "
            f"source={item.source} expected_answer={item.expected_answer}"
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
